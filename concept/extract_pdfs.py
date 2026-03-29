import pymupdf
import os

concept_dir = os.path.dirname(os.path.abspath(__file__))

pdfs = [
    ("Database Architecture.pdf", "db_arch.txt"),
    ("Detailed System & Data Flow Architecture.pdf", "system_flow.txt"),
    ("Trading System Architecture_ Account-Centric Isolation.pdf", "trading_arch.txt"),
]

for pdf_name, txt_name in pdfs:
    pdf_path = os.path.join(concept_dir, pdf_name)
    txt_path = os.path.join(concept_dir, txt_name)
    if os.path.exists(pdf_path):
        doc = pymupdf.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Extracted: {pdf_name} -> {txt_name}")
    else:
        print(f"Not found: {pdf_name}")
