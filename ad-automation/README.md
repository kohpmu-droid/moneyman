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

## "רק תבקשי" — מחולל מודעה מבקשה חופשית

הפקודה `generate` הופכת **בקשה חופשית בעברית** למודעה מוכנה: היא כותבת את הטקסטים (כותרת, גוף, קריאה לפעולה), מגדירה קהל יעד וטקסטים לטופס הלידים, **ומעצבת תמונת מודעה** — הכל לקובץ `brief.json` מוכן להעלאה.

```bash
npm run build
npm run generate:built -- "מודעה למבצע קיץ לחנות תכשיטים, נשים 30-45" --budget=60
```

התוצאה: `out/brief.json` + `out/creative.png` (מודעה 1080×1350 מעוצבת, RTL). אחר כך פשוט:

```bash
npm run create:built -- out/brief.json    # יוצר הכל כטיוטה (PAUSED)
```

### דגלים

| דגל | ברירת מחדל | הסבר |
|------|:---:|------|
| `--budget=50` | 50 | תקציב יומי בשקלים |
| `--out=./out` | `./out` | תיקיית פלט |
| `--privacy=URL` | מ-`.env` | קישור מדיניות פרטיות לטופס |
| `--video=clip.mp4` | — | להשתמש בסרטון מוכן במקום תמונה מיוצרת |
| `--no-image` | — | לא לייצר תמונה (תוסיפי בעצמך) |

### הכנה

1. **מפתח Anthropic** — הגדירי `ANTHROPIC_API_KEY` ב-`.env` (הכלי משתמש ב-Claude כדי לכתוב את המודעה).
2. **רינדור התמונה** — צריך דפדפן: `npm install playwright && npx playwright install chromium`. אם Playwright לא מותקן, הכלי כותב במקום זאת קובץ HTML שאפשר לצלם/להמיר לתמונה.

> ⚠️ הטקסט נכתב ע"י Claude לפי כללי Meta, אך תמיד כדאי לקרוא ולערוך לפני העלאה. קוד הקריאה ל-Claude נכתב לפי מבנה ה-API אך טרם הורץ מול מפתח אמת.

---

## איסוף הלידים ל-Google Sheet

הפקודה `sync-leads` מושכת את הלידים שנכנסו דרך הטפסים ומוסיפה אותם ל-Google Sheet. היא **חסינת-כפילויות** — ליד שכבר קיים בגיליון (לפי ה-Lead ID) מדולג, אז אפשר להריץ אותה שוב ושוב (למשל בתזמון) בלי חשש.

עמודות הגיליון (נכתבות אוטומטית בשורת הכותרת בהרצה הראשונה):
`Received | Lead ID | Form | Full name | Email | Phone | All fields`

### הכנה חד-פעמית (Google)

1. ב-[Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → הפעילו את **Google Sheets API**.
2. צרו **Service Account** והורידו לו מפתח **JSON**.
3. פתחו את ה-Google Sheet שלכם ולחצו **Share** — שתפו אותו עם כתובת המייל של ה-Service Account (מסתיימת ב-`...iam.gserviceaccount.com`) עם הרשאת **Editor**.
4. העתיקו את ה-**Sheet ID** מתוך ה-URL: `/spreadsheets/d/<זה_ה-ID>/edit`.
5. מלאו ב-`.env`: `GOOGLE_SHEET_ID`, וכן `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` (נתיב לקובץ ה-JSON) או `GOOGLE_SERVICE_ACCOUNT_KEY` (ה-JSON עצמו).

בצד Meta ה-token כבר צריך `leads_retrieval` (מופיע ברשימת ההרשאות למעלה).

### הרצה

```bash
npm run build
npm run sync-leads:built
```

כברירת מחדל מסונכרנים כל הטפסים בדף. לצמצום לטפסים מסוימים: `LEAD_FORM_IDS=123,456` ב-`.env`.

### התראת וואטסאפ על כל ליד חדש

אם מגדירים משתני `WHATSAPP_*` ב-`.env`, כל ליד חדש שנכנס לגיליון גם שולח לך **הודעת וואטסאפ** (דרך ה-WhatsApp Business Cloud API של Meta). זה נכלל אוטומטית ב-`sync-leads` — לא צריך פקודה נפרדת.

**הכנה חד-פעמית:**

1. ב-Meta Business, פתחי **WhatsApp Business** → **API setup**, וקבלי **Phone number ID** ו-Access Token עם ההרשאה `whatsapp_business_messaging`.
2. הוסיפי את המספר שלך כ-recipient (בבדיקה הראשונית Meta מגבילה לנמענים מאומתים).
3. חשוב להבין: כדי לשלוח לעצמך הודעה **בכל זמן** צריך **תבנית (Template) מאושרת**. צרי ב-Meta תבנית בקטגוריית **Utility** עם גוף כזה (3 משתנים):

   > 🔔 ליד חדש! שם: `{{1}}` · טלפון: `{{2}}` · אימייל: `{{3}}`

   ומלאי `WHATSAPP_TEMPLATE_NAME` בשם התבנית.

**לבדיקה מהירה:** שלחי הודעה כלשהי מהוואטסאפ שלך למספר העסקי, ואז הריצי עם `WHATSAPP_MODE=text` — במצב זה נשלח טקסט חופשי (עובד רק 24 שעות אחרי שכתבת לעסק, בלי צורך בתבנית).

מגבלת בטיחות: `WHATSAPP_MAX_PER_RUN` (ברירת מחדל 20) מונע הצפה בהרצה הראשונה.

### תזמון אוטומטי (רץ לבד כל כמה דקות)

הוסיפו ל-crontab (למשל כל 15 דקות):

```cron
*/15 * * * * cd /path/to/ad-automation && npm run sync-leads:built >> sync.log 2>&1
```

---

## מה הכלי עושה ומה לא

**כן:** מייצר מודעה מלאה (טקסט + תמונה מעוצבת) מבקשה חופשית בעברית, מעלה מדיה, יוצר קמפיין/ad set/מודעה, יוצר ומחבר טופס לידים, ברירת מחדל PAUSED, מצב dry-run, ומסנכרן לידים אוטומטית ל-Google Sheet (חסין כפילויות) עם התראת וואטסאפ על כל ליד חדש.

**לא:** לא מפיק וידאו מקצועי (מקבל קובץ מוכן), ולא עוקף את אישור המודעות של Meta.

---

## אבטחה

- אל תעלו את `.env` ל-git — הוא כבר ב-`.gitignore`.
- ה-token מאפשר להוציא כסף. שמרו אותו בזהירות, ורצוי System User token עם תוקף מוגבל.
