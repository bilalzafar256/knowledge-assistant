# Sample documents for testing upload → index → chat

A small, self-consistent knowledge base for the fictional **Northwind Industries**.
Every file holds **verbatim, checkable facts** (numbers, dates, emails) so you can
confirm the assistant answers *only* from the documents (grounding) rather than
guessing. Each format exercises a different extractor in the ingestion pipeline.

Upload these on **Dashboard → Documents → Upload**, wait for **"indexed" / "ready"**,
then ask the questions below in chat.

## Files & what they exercise

| File | Format | Extractor under test |
|------|--------|----------------------|
| `employee-handbook.pdf` | PDF | `pdf-parse` |
| `expense-policy.docx` | Word (DOCX) | `mammoth` |
| `salary-bands.xlsx` | Excel (2 sheets) | `xlsx` → CSV |
| `security-policy.md` | Markdown | UTF-8 passthrough |
| `it-faq.txt` | Plain text | UTF-8 passthrough |
| `product-catalog.json` | JSON | UTF-8 passthrough |
| `handbook-page.png` | Image | Claude vision OCR |

> The `.txt` source files for the PDF/DOCX are kept alongside them so you can see the
> expected text. Legacy binary `.doc` is intentionally **not** supported — the app
> returns a clear "re-save as .docx" message.

## Test questions (with the grounded answer to check against)

### employee-handbook.pdf
- *How many days of annual leave do full-time employees get?* → **25 days**
- *How much unused leave can I carry over, and what happens to the rest?* → **5 days; anything above is forfeited on January 31**
- *How many days a week can I work remotely without director approval?* → **up to 3 days**
- *How long is the probationary period?* → **90 days**
- *How much paid parental leave does a primary caregiver get?* → **16 weeks**

### expense-policy.docx
- *Who approves an expense of $3,000?* → **a manager (the $501–$5,000 band)**
- *What is the international per diem?* → **$110 per day**
- *What is the mileage reimbursement rate?* → **$0.67 per mile**
- *How many days do I have to submit receipts?* → **30 days (not reimbursed after 60)**
- *What is the home-office stipend and how often is it refreshed?* → **$1,200, every 2 years**

### salary-bands.xlsx
- *What is the salary range for a Staff Engineer?* → **$175,000–$220,000 (L4)**
- *How many equity units does a Principal Engineer get?* → **12,000**
- *When does the H1 2026 review window close?* → **2026-03-21**
- *What is the raise pool for H2 2026?* → **3.5%**

### security-policy.md
- *What is the minimum password length and rotation period?* → **14 characters, every 90 days**
- *Who needs a hardware security key?* → **anyone with production database access**
- *Where and how fast must I report a security incident?* → **security@northwind.example within 1 hour**
- *How is salary data classified?* → **Confidential**

### it-faq.txt
- *How do I reach the IT help desk and how fast do they respond?* → **it-support@northwind.example / #it-help, within 4 business hours**
- *What laptop do engineers get?* → **16-inch MacBook Pro, 36 GB RAM**
- *How much company Drive storage do I get?* → **100 GB**

### product-catalog.json
- *What is the price of the EdgeGateway 220?* → **$1,180**
- *What is the operating temperature range of the TempSense 100?* → **-40 °C to 125 °C**
- *What bulk discount applies, and at what quantity?* → **12% at 50+ units**

### handbook-page.png (OCR)
- Same questions as `employee-handbook.pdf` — confirms vision OCR reads the image.

## Grounding / negative tests (the assistant should REFUSE, not invent)

These facts are **not** in any document — a correct answer is *"I couldn't find
information about this in the knowledge base."*

- *What is Northwind's 401(k) employer match?*
- *How many vacation days do contractors get?*
- *What is the CEO's home address?*
- *What is the price of the EdgeGateway 500?* (only the 220 exists)

## Multi-document questions (tests retrieval across files)

- *Both the handbook and the expense policy mention a 30-day window — what is each for?*
  → **handbook: nothing 30-day; expense policy: receipt submission within 30 days** (the assistant should distinguish, not conflate)
- *I'm an L3 Senior Engineer working remotely — what's my salary range and home-office stipend?*
  → **$135,000–$175,000 (salary-bands.xlsx) + $1,200 stipend (expense-policy.docx)**
