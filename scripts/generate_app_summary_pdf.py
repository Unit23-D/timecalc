#!/usr/bin/env python3
from pathlib import Path


PAGE_WIDTH = 612
PAGE_HEIGHT = 792


def pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def wrap_text(text: str, max_chars: int) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if len(trial) <= max_chars:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def add_text_block(ops: list[str], x: int, y: int, lines: list[str], font: str, size: int, leading: int) -> int:
    ops.append("BT")
    ops.append(f"/{font} {size} Tf")
    ops.append(f"{x} {y} Td")
    first, *rest = lines
    ops.append(f"({pdf_escape(first)}) Tj")
    for line in rest:
        ops.append(f"0 -{leading} Td")
        ops.append(f"({pdf_escape(line)}) Tj")
    ops.append("ET")
    return y - leading * len(lines)


def add_section(ops: list[str], x: int, y: int, width_chars: int, title: str, lines: list[tuple[str, bool]]) -> int:
    y = add_text_block(ops, x, y, [title], "F2", 12, 14)
    y -= 4
    for text, is_bullet in lines:
        if is_bullet:
            wrapped = wrap_text(text, width_chars - 4)
            bullet_lines = [f"- {wrapped[0]}"] + [f"  {line}" for line in wrapped[1:]]
            y = add_text_block(ops, x + 6, y, bullet_lines, "F1", 10, 12)
        else:
            wrapped = wrap_text(text, width_chars)
            y = add_text_block(ops, x, y, wrapped, "F1", 10, 12)
        y -= 4
    return y


def build_pdf(content_stream: str) -> bytes:
    objects: list[bytes] = []

    def add_object(body: bytes) -> int:
        objects.append(body)
        return len(objects)

    catalog_id = add_object(b"<< /Type /Catalog /Pages 2 0 R >>")
    pages_id = add_object(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    page_id = add_object(
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>"
    )
    font_regular_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    font_bold_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    content_bytes = content_stream.encode("ascii")
    contents_id = add_object(
        f"<< /Length {len(content_bytes)} >>\nstream\n".encode("ascii") + content_bytes + b"\nendstream"
    )

    assert [catalog_id, pages_id, page_id, font_regular_id, font_bold_id, contents_id] == [1, 2, 3, 4, 5, 6]

    output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for index, body in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode("ascii"))
        output.extend(body)
        output.extend(b"\nendobj\n")

    xref_offset = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    output.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    output.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("ascii")
    )
    return bytes(output)


def main() -> None:
    output_dir = Path("/Users/dev/timecalc/output/pdf")
    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = output_dir / "timecalc-app-summary.pdf"

    ops: list[str] = [
        "0.96 0.97 0.99 rg",
        "36 726 540 40 re f",
        "0 0 0 rg",
    ]

    add_text_block(ops, 48, 750, ["TimeCalc App Summary"], "F2", 20, 22)
    add_text_block(ops, 48, 730, ["Repo-based one-page overview"], "F1", 10, 12)

    left_x = 48
    right_x = 320
    top_y = 690

    left_y = add_section(
        ops,
        left_x,
        top_y,
        34,
        "What It Is",
        [
            (
                "A small Express and SQLite web app for tracking time ranges and recent entries.",
                False,
            ),
            (
                "Users enter start and end times in the browser, see a live countdown, and save entries through a JSON API.",
                False,
            ),
        ],
    )

    left_y = add_section(
        ops,
        left_x,
        left_y - 6,
        34,
        "Who It Is For",
        [
            (
                "People who want a lightweight personal tool to calculate time ranges and keep a short recent history of saved entries.",
                False,
            ),
        ],
    )

    left_y = add_section(
        ops,
        left_x,
        left_y - 6,
        34,
        "How To Run",
        [
            ("cd /Users/dev/timecalc/app/server", True),
            ("npm install", True),
            ("node index.js", True),
            ("Open http://localhost:3000", True),
        ],
    )

    left_y = add_section(
        ops,
        left_x,
        left_y - 6,
        34,
        "Repo Notes",
        [
            ("Tests: Not found in repo.", False),
            ("Authentication or multi-user support: Not found in repo.", False),
        ],
    )

    right_y = add_section(
        ops,
        right_x,
        top_y,
        37,
        "What It Does",
        [
            ("Accepts start and end times with native browser time inputs.", True),
            ("Includes preset buttons for weekday 6:20 and weekend 10:00 end times.", True),
            ("Shows a live remaining duration and an ends today/tomorrow label.", True),
            ("Lets users save calculated entries through POST /api/entries.", True),
            ("Lists recent saved entries from SQLite through GET /api/entries.", True),
            ("Supports clearing all saved entries with DELETE /api/entries.", True),
        ],
    )

    right_y = add_section(
        ops,
        right_x,
        right_y - 6,
        37,
        "How It Works",
        [
            (
                "Frontend: /app/public/index.html, app.js, and styles.css render the UI, compute the live countdown in the browser, and call the API.",
                False,
            ),
            (
                "API: /app/server/index.js serves static files and exposes create, list, and clear entry routes.",
                False,
            ),
            (
                "Time logic: /app/server/time.js calculates ranges and handles overnight end times by rolling to the next day when needed.",
                False,
            ),
            (
                "Storage: /app/server/db.js opens better-sqlite3, creates the entries table, and resolves the database path from TIMECALC_DB_PATH, /data, or a local file.",
                False,
            ),
            (
                "Deploy path: Docker runs the Node server; Kubernetes adds a Deployment, Service, Ingress, and PVC so the app can persist SQLite data at /data/timecalc.sqlite.",
                False,
            ),
        ],
    )

    add_text_block(
        ops,
        48,
        54,
        ["Evidence sources: README.md, app/server/*, app/public/*, app/Dockerfile, k8s/*"],
        "F1",
        8,
        10,
    )

    pdf_bytes = build_pdf("\n".join(ops))
    pdf_path.write_bytes(pdf_bytes)
    print(pdf_path)


if __name__ == "__main__":
    main()
