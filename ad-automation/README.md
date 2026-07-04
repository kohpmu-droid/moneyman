# ad-automation

תהליך אוטומטי להעלאת **מודעה ממומנת לפייסבוק ואינסטגרם עם טופס לידים** — נותנים "בריף" אחד (קובץ JSON), והכלי מקים את הכל דרך ה-Meta Marketing API: מעלה את התמונה/סרטון, יוצר קמפיין → ad set → creative → מודעה, ומחבר טופס לידים (Instant Form).

> **בטיחות קודם כל:** כברירת מחדל הכל נוצר במצב **PAUSED** — שום כסף לא יוצא עד שאתם נכנסים ל-Ads Manager, בודקים, ומפעילים ידנית. הפעלה אוטומטית דורשת דגל מפורש (`ACTIVATE_ADS=true`).

> ⚠️ הכלי כתוב מול המבנה המתועד של Meta Marketing API אך **טרם הורץ מול חשבון אמת**. הריצו קודם עם `DRY_RUN=true`, ואז מודעה אחת קטנה במצב PAUSED, לפני שסומכים עליו לרוטינה.

---

## מה צריך פעם אחת (הכנה חד-פעמית מול Meta)

יש לכם כבר Business Manager, חשבון מודעות ודף — מצוין. נשאר רק:

1. **אפליקציית מפתחים** ב-<https://developers.facebook.com> → Create App → סוג "Business".
2. הוסיפו את המוצר **Marketing API** לאפליקציה.
3. צרו **System User** ב-Business Settings, תנו לו גישה לחשבון המודעות ולדף, והנפיקו **Access Token** עם ההרשאות:
   - `ads_management`
   - `leads_retrieval`
   - `pages_manage_ads`
   - `pages_read_engagement`
   - `business_management`
4. כדי שהמודעות יֵצאו בפועל (ולא רק כטיוטה שלכם), האפליקציה צריכה לעבור **App Review** של Meta להרשאות האלה. עד שזה קורה — אפשר לעבוד במצב PAUSED / DRY_RUN עם token של מנהל האפליקציה.

מזהים שתצטרכו: **Ad Account ID** (מספרים, מופיע כ-`act_...`), **Page ID**, ואופציונלית **Instagram account ID** המחובר לדף.

---

## התקנה

```bash
cd ad-automation
npm install          # מתקין רק את TypeScript (אין תלויות ריצה — משתמשים ב-fetch המובנה של Node)
cp .env.example .env # ואז ממלאים את הערכים
```

דרוש Node 20+ (מומלץ 22+).

---

## שימוש

הבריף הוא קובץ JSON יחיד. יש דוגמה מלאה ב-[`examples/brief.example.json`](examples/brief.example.json).

**1. הרצת יבש (לא שולח כלום ל-Meta) — כדי לראות שהכל תקין:**

```bash
DRY_RUN=true npm run create -- examples/brief.example.json
```

**2. יצירה אמיתית במצב PAUSED (ברירת מחדל בטוחה):**

```bash
npm run build
npm run create:built -- examples/brief.example.json
```

בסיום מודפס קישור ישיר ל-Ads Manager לבדיקה והפעלה.

**3. הפעלה אוטומטית מלאה (מוציא כסף אחרי אישור Meta):**

```bash
ACTIVATE_ADS=true npm run create:built -- examples/brief.example.json
```

---

## מבנה הבריף

| שדה | חובה | הסבר |
|------|:---:|------|
| `campaignName` | ✅ | שם הקמפיין |
| `dailyBudget` | ✅ | תקציב יומי בשקלים (המרה ל-agorot אוטומטית) |
| `creative.type` | ✅ | `"image"` או `"video"` |
| `creative.path` | ✅ | נתיב מקומי לקובץ המדיה |
| `creative.thumbnailPath` | | תמונת תצוגה לסרטון |
| `copy.primaryText` | ✅ | הטקסט הראשי מעל המדיה |
| `copy.headline` | ✅ | כותרת קצרה |
| `copy.description` | | שורת משנה |
| `copy.callToAction` | | כפתור, ברירת מחדל `SIGN_UP` |
| `targeting.countries` | | קודי מדינה, ברירת מחדל `["IL"]` |
| `targeting.ageMin/ageMax` | | טווח גילאים |
| `targeting.genders` | | `["female"]` / `["male"]`, השמטה = כולם |
| `targeting.interests` | | תחומי עניין (צריך `id` של Meta) |
| `leadForm.name` | ✅ | שם טופס הלידים |
| `leadForm.privacyPolicyUrl` | ✅ | קישור למדיניות פרטיות (חובה מצד Meta) |
| `leadForm.questions` | | שדות לאיסוף, ברירת מחדל שם+מייל+טלפון |
| `leadForm.intro` / `thankYou` | | מסך פתיחה ומסך תודה |
| `link` | | קישור יעד, ברירת מחדל דף הפייסבוק |

### מציאת `id` לתחומי עניין (targeting)

```bash
curl -G "https://graph.facebook.com/v21.0/search" \
  --data-urlencode "type=adinterest" \
  --data-urlencode "q=כושר" \
  --data-urlencode "access_token=$META_ACCESS_TOKEN"
```

---

## מה הכלי עושה ומה לא

**כן:** מעלה מדיה, יוצר קמפיין/ad set/מודעה, יוצר ומחבר טופס לידים, ברירת מחדל PAUSED, מצב dry-run.

**לא:** לא מפיק וידאו מקצועי (מקבל קובץ מוכן), לא עוקף את אישור המודעות של Meta, ולא שולף את הלידים עצמם — לאיסוף הלידים ל-Sheets/מייל צריך שלב נוסף (webhook של `leadgen` או משיכה תקופתית מ-`/{form_id}/leads`). אפשר להוסיף.

---

## אבטחה

- אל תעלו את `.env` ל-git — הוא כבר ב-`.gitignore`.
- ה-token מאפשר להוציא כסף. שמרו אותו בזהירות, ורצוי System User token עם תוקף מוגבל.
