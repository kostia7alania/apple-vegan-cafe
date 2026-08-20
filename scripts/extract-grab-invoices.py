#!/usr/bin/env python3
"""Extract a private analytical CSV from Grab receipt/tax-invoice PDFs.

The original PDFs are never modified. Thai Grab invoices can be password protected
with the merchant tax ID; when possible, this script discovers that value from an
unencrypted invoice in the same batch. If every PDF is encrypted, provide the value
only for the current process through GRAB_INVOICE_PASSWORD.

Usage:
    python3 scripts/extract-grab-invoices.py grab-backup.local/YYYY-MM-DD
"""

from __future__ import annotations

import csv
import io
import os
import re
import stat
import subprocess
import sys
import tempfile
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError as error:
    raise SystemExit(
        "pypdf is required: install it in the active Python environment with "
        "`python3 -m pip install pypdf`"
    ) from error


DOCUMENT_TITLE = "RECEIPT / TAX INVOICE"
MONEY_PATTERN = r"[0-9,]+\.\d{2}"


@dataclass(frozen=True)
class InvoiceRow:
    invoice_date: str
    service_date: str
    invoice_number: str
    source_pdf: str
    original_encrypted: bool
    document_type: str
    description: str
    quantity: int
    subtotal_thb: str
    vat_rate_pct: str
    vat_thb: str
    grand_total_thb: str
    partner_id: str


def decode_shifted_ascii(value: str) -> str:
    """Undo Grab's historical custom-font ASCII offset without touching Thai bytes."""

    return "".join(
        chr(ord(character) + 29)
        if character not in " \n\r\t" and ord(character) <= 126
        else character
        for character in value
    )


def normalize_text(value: str, filename: str) -> str:
    if DOCUMENT_TITLE in value:
        return value
    shifted = decode_shifted_ascii(value)
    if DOCUMENT_TITLE in shifted:
        return shifted
    raise ValueError(f"{filename}: unsupported invoice text encoding")


def extract_reader_text(reader: PdfReader, filename: str) -> str:
    if len(reader.pages) != 1:
        raise ValueError(f"{filename}: expected one page, found {len(reader.pages)}")
    return normalize_text(reader.pages[0].extract_text() or "", filename)


def thai_tax_id_is_valid(value: str) -> bool:
    if not re.fullmatch(r"\d{13}", value):
        return False
    weighted_sum = sum(int(value[index]) * (13 - index) for index in range(12))
    return (11 - weighted_sum % 11) % 10 == int(value[-1])


def tax_ids_from_text(value: str) -> set[str]:
    return set(re.findall(r"(?m)^([0-9]{13})$", value))


def parse_money(value: str) -> Decimal:
    return Decimal(value.replace(",", ""))


def decimal_field(row: dict[str, str], field: str, source: str) -> Decimal:
    value = row.get(field, "").strip()
    if not value:
        raise ValueError(f"{source}: missing {field}")
    try:
        parsed = Decimal(value)
    except InvalidOperation as error:
        raise ValueError(f"{source}: invalid {field}") from error
    if not parsed.is_finite():
        raise ValueError(f"{source}: invalid {field}")
    return parsed


def iso_date(value: str, source_format: str) -> str:
    return datetime.strptime(value, source_format).date().isoformat()


def required_match(pattern: str, text: str, filename: str, field: str) -> re.Match[str]:
    match = re.search(pattern, text, flags=re.MULTILINE)
    if match is None:
        raise ValueError(f"{filename}: missing {field}")
    return match


def parse_invoice(path: Path, text: str, original_encrypted: bool) -> tuple[InvoiceRow, str]:
    identity = required_match(
        r"\b(IM\d{14})\b\s*\n(\d{2}/\d{2}/\d{4})",
        text,
        path.name,
        "invoice identity",
    )
    service = required_match(
        r"^Service Fee - (\d{2}-\d{2}-\d{4})\s+(\d+)\s+",
        text,
        path.name,
        "service row",
    )
    subtotal_match = required_match(
        rf"^({MONEY_PATTERN})[^\n]*\nTotal Amount$",
        text,
        path.name,
        "subtotal",
    )
    vat_rate = required_match(r"^VAT\s+(\d+(?:\.\d+)?)\s+%$", text, path.name, "VAT rate")
    vat_and_total = required_match(
        rf"^Grand Total\s*\n({MONEY_PATTERN})\s*\n({MONEY_PATTERN})$",
        text,
        path.name,
        "VAT and grand total",
    )
    partner = required_match(r"(?m)^(THMG\d+)$", text, path.name, "partner ID")
    found_tax_ids = tax_ids_from_text(text)
    if len(found_tax_ids) != 1:
        raise ValueError(f"{path.name}: expected one merchant tax ID, found {len(found_tax_ids)}")
    tax_id = next(iter(found_tax_ids))
    if not thai_tax_id_is_valid(tax_id):
        raise ValueError(f"{path.name}: merchant tax ID failed checksum validation")

    invoice_number = identity.group(1)
    if path.stem != invoice_number:
        raise ValueError(f"{path.name}: filename does not match invoice number {invoice_number}")

    invoice_date = iso_date(identity.group(2), "%d/%m/%Y")
    service_date = iso_date(service.group(1), "%d-%m-%Y")
    if invoice_date != service_date:
        raise ValueError(f"{path.name}: invoice and service dates differ")

    quantity = int(service.group(2))
    subtotal = parse_money(subtotal_match.group(1))
    vat = parse_money(vat_and_total.group(1))
    grand_total = parse_money(vat_and_total.group(2))
    if subtotal + vat != grand_total:
        raise ValueError(f"{path.name}: subtotal plus VAT does not equal grand total")
    expected_vat = (subtotal * Decimal(vat_rate.group(1)) / Decimal(100)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    # Grab sometimes derives the displayed pre-VAT amount from an already rounded
    # tax-inclusive total. That can leave a one-satang residual in the VAT column.
    if abs(expected_vat - vat) > Decimal("0.01"):
        raise ValueError(f"{path.name}: VAT differs materially from the stated rate")

    return (
        InvoiceRow(
            invoice_date=invoice_date,
            service_date=service_date,
            invoice_number=invoice_number,
            source_pdf=path.name,
            original_encrypted=original_encrypted,
            document_type=DOCUMENT_TITLE,
            description="Service Fee",
            quantity=quantity,
            subtotal_thb=f"{subtotal:.2f}",
            vat_rate_pct=vat_rate.group(1),
            vat_thb=f"{vat:.2f}",
            grand_total_thb=f"{grand_total:.2f}",
            partner_id=partner.group(1),
        ),
        tax_id,
    )


def is_within(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def resolve_private_backup_root(value: str) -> Path:
    project_root = Path.cwd().resolve(strict=True)
    requested_root = Path(os.path.abspath(value))
    backup_root = Path(value).resolve(strict=True)
    forbidden_roots = [project_root / name for name in (".git", "public", "src", "dist")]

    for forbidden_root in forbidden_roots:
        if is_within(requested_root, forbidden_root) or is_within(backup_root, forbidden_root):
            raise ValueError(f"refusing private output inside {forbidden_root}")

    if is_within(backup_root, project_root):
        ignored = subprocess.run(
            ["git", "check-ignore", "--quiet", "--", str(backup_root)],
            cwd=project_root,
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if backup_root == project_root or ignored.returncode != 0:
            raise ValueError(
                "private backup paths inside this repository must already be excluded by .gitignore"
            )

    return backup_root


def ensure_private_output_directory(backup_root: Path, relative_path: str) -> Path:
    current = backup_root.resolve(strict=True)
    for part in Path(relative_path).parts:
        if part in {"", ".", ".."}:
            raise ValueError(f"invalid private output directory: {relative_path}")
        current = current / part
        try:
            mode = current.lstat().st_mode
            if stat.S_ISLNK(mode) or not stat.S_ISDIR(mode):
                raise ValueError(f"private output directory must be a real directory: {current}")
        except FileNotFoundError:
            current.mkdir(mode=0o700)

    resolved = current.resolve(strict=True)
    if not is_within(resolved, backup_root):
        raise ValueError(f"private output directory escapes snapshot root: {relative_path}")
    return resolved


def write_private_text_atomic(directory: Path, filename: str, content: str) -> None:
    if Path(filename).name != filename:
        raise ValueError(f"invalid private filename: {filename}")
    if directory.resolve(strict=True) != directory:
        raise ValueError(f"private output directory changed during write: {directory}")

    descriptor, temporary_name = tempfile.mkstemp(
        dir=directory, prefix=f".{filename}.", suffix=".tmp", text=True
    )
    temporary_path = Path(temporary_name)
    descriptor_owned = True
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as output:
            descriptor_owned = False
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary_path, directory / filename)
    except Exception:
        if descriptor_owned:
            try:
                os.close(descriptor)
            except OSError:
                pass
        temporary_path.unlink(missing_ok=True)
        raise


def main() -> int:
    args = sys.argv[1:]
    if args[:1] == ["--"]:
        args = args[1:]
    if len(args) != 1 or args[0] in {"-h", "--help"}:
        output = print
        output("usage: python3 scripts/extract-grab-invoices.py <grab-backup-directory>")
        return 0 if len(args) == 1 else 1

    backup_root = resolve_private_backup_root(args[0])
    source_dir = backup_root / "raw" / "finance-documents" / "invoices"
    normalized_dir = backup_root / "normalized"
    paths = sorted(source_dir.glob("*.pdf"))
    if not paths:
        raise ValueError(f"no invoice PDFs found in {source_dir}")

    unencrypted_text: dict[Path, str] = {}
    discovered_tax_ids: set[str] = set()
    encrypted_paths: list[Path] = []
    for path in paths:
        reader = PdfReader(path)
        if reader.is_encrypted:
            encrypted_paths.append(path)
            continue
        text = extract_reader_text(reader, path.name)
        unencrypted_text[path] = text
        discovered_tax_ids.update(tax_ids_from_text(text))

    configured_password = os.environ.get("GRAB_INVOICE_PASSWORD", "").strip()
    if len(discovered_tax_ids) > 1:
        raise ValueError("unencrypted invoices contain more than one merchant tax ID")
    discovered_password = next(iter(discovered_tax_ids), "")
    password = configured_password or discovered_password
    if encrypted_paths and not password:
        raise ValueError(
            "encrypted invoices found but no password could be discovered; set "
            "GRAB_INVOICE_PASSWORD only for this process"
        )

    rows: list[InvoiceRow] = []
    parsed_tax_ids: Counter[str] = Counter()
    for path in paths:
        original_encrypted = path in encrypted_paths
        if path in unencrypted_text:
            text = unencrypted_text[path]
        else:
            reader = PdfReader(path)
            if not reader.decrypt(password):
                raise ValueError(f"{path.name}: invoice password was rejected")
            text = extract_reader_text(reader, path.name)
        row, tax_id = parse_invoice(path, text, original_encrypted)
        rows.append(row)
        parsed_tax_ids[tax_id] += 1

    rows.sort(key=lambda row: (row.invoice_date, row.invoice_number))
    if len(parsed_tax_ids) != 1:
        raise ValueError("parsed invoices contain more than one merchant tax ID")
    if len({row.partner_id for row in rows}) != 1:
        raise ValueError("parsed invoices contain more than one Partner ID")
    if len({row.invoice_number for row in rows}) != len(rows):
        raise ValueError("duplicate invoice numbers found")
    if len({row.invoice_date for row in rows}) != len(rows):
        raise ValueError("more than one service invoice found for a date")

    subtotal = sum((Decimal(row.subtotal_thb) for row in rows), Decimal(0))
    vat = sum((Decimal(row.vat_thb) for row in rows), Decimal(0))
    grand_total = sum((Decimal(row.grand_total_thb) for row in rows), Decimal(0))
    overlap_summary = ""
    sales_path = normalized_dir / "sales-daily-alltime.csv"
    if sales_path.exists():
        with sales_path.open(encoding="utf-8", newline="") as source:
            sales_rows = list(csv.DictReader(source))
        parsed_sales: list[tuple[str, Decimal]] = []
        for index, row in enumerate(sales_rows, start=2):
            source = f"sales-daily-alltime.csv row {index}"
            sales_date = row.get("Date", "").strip()
            try:
                sales_date = iso_date(sales_date, "%Y-%m-%d")
            except ValueError as error:
                raise ValueError(f"{source}: invalid Date") from error
            parsed_sales.append((sales_date, decimal_field(row, "Net sales THB", source)))
        if len({sales_date for sales_date, _ in parsed_sales}) != len(parsed_sales):
            raise ValueError("sales-daily-alltime.csv contains duplicate dates")
        parsed_sales.sort(key=lambda row: row[0])
        positive_sales = [
            (sales_date, net_sales)
            for sales_date, net_sales in parsed_sales
            if net_sales > 0
            and rows[0].invoice_date <= sales_date <= rows[-1].invoice_date
        ]
        if positive_sales:
            overlap_start = positive_sales[0][0]
            overlap_net_sales = sum(
                (net_sales for _, net_sales in positive_sales), Decimal(0)
            )
            overlap_service_fee = sum(
                (
                    Decimal(row.subtotal_thb)
                    for row in rows
                    if overlap_start <= row.invoice_date <= positive_sales[-1][0]
                ),
                Decimal(0),
            )
            overlap_rate = overlap_service_fee / overlap_net_sales * Decimal(100)
            overlap_summary = f"""
Comparable Grab-labelled overlap ({overlap_start} to {positive_sales[-1][0]}):
service fee before VAT **฿{overlap_service_fee:.2f}** versus net sales
**฿{overlap_net_sales:.2f}**, or **{overlap_rate:.2f}%**. This is a platform-fee
burden indicator, not contribution margin; it excludes food, labour, rent and other
costs and can still be affected by Grab adjustments/timing.
"""
    encryption_source = (
        "tax ID discovered from an unencrypted invoice in the same private batch"
        if discovered_password and not configured_password
        else "process-local GRAB_INVOICE_PASSWORD"
    )
    report = f"""# Grab invoice extraction

- Source PDFs parsed: **{len(rows)}** ({rows[0].invoice_date} to {rows[-1].invoice_date}).
- Original files: **{len(encrypted_paths)} encrypted**, **{len(rows) - len(encrypted_paths)} unencrypted**.
- Password source for encrypted originals: **{encryption_source}**.
- Merchant identity: one consistent Partner ID and one consistent 13-digit Thai tax ID across all PDFs; the tax ID passes the Thai checksum and is intentionally omitted from derived output.
- Rows: **{len(rows)} unique invoice numbers**, **{len(rows)} unique service dates**, one `Service Fee` row per PDF.

| Grab invoice field | Total |
| --- | ---: |
| Service fee before VAT | ฿{subtotal:.2f} |
| VAT | ฿{vat:.2f} |
| Grand total | ฿{grand_total:.2f} |

{overlap_summary.strip()}

Exact extracted rows are stored in `normalized/invoice-service-fees-alltime.csv`.
The CSV deliberately excludes the merchant tax ID, owner name and address because they
are unnecessary for analysis. Original PDFs remain unchanged under
`raw/finance-documents/invoices/`. These documents describe Grab service fees and VAT;
they are costs/tax evidence, not sales or profit.
"""

    csv_output = io.StringIO(newline="")
    writer = csv.DictWriter(csv_output, fieldnames=list(asdict(rows[0]).keys()))
    writer.writeheader()
    writer.writerows(asdict(row) for row in rows)

    safe_normalized_dir = ensure_private_output_directory(backup_root, "normalized")
    safe_reports_dir = ensure_private_output_directory(backup_root, "reports")
    write_private_text_atomic(
        safe_normalized_dir, "invoice-service-fees-alltime.csv", csv_output.getvalue()
    )
    write_private_text_atomic(safe_reports_dir, "INVOICE-EXTRACTION.md", report)

    print(f"parsed {len(rows)} invoice PDFs")
    print(f"encrypted originals decrypted: {len(encrypted_paths)}")
    print(f"date range: {rows[0].invoice_date} to {rows[-1].invoice_date}")
    print(f"grand total: THB {grand_total:.2f}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"invoice extraction failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
