import { generateJson, type AnthropicOptions } from "./anthropic.js";
import type { CallToActionType, LeadQuestionType } from "../types.js";

/**
 * The parts of an ad brief the model writes from a free-form request.
 * Budget, creative file, and the privacy-policy URL are supplied by the
 * operator (they aren't things the model can invent), so they're not here.
 */
export interface BriefContent {
  campaignName: string;
  copy: {
    primaryText: string;
    headline: string;
    description: string;
    callToAction: CallToActionType;
  };
  targeting: {
    countries: string[];
    ageMin: number;
    ageMax: number;
    genders: Array<"male" | "female">;
  };
  leadForm: {
    name: string;
    intro: { headline: string; description: string };
    questions: LeadQuestionType[];
    thankYou: { title: string; body: string };
  };
  /** Suggested colors for the auto-generated image (hex). */
  imageColors: { background: string; text: string; accent: string };
}

const CTA_VALUES: CallToActionType[] = [
  "SIGN_UP",
  "LEARN_MORE",
  "GET_QUOTE",
  "SUBSCRIBE",
  "APPLY_NOW",
  "BOOK_TRAVEL",
  "CONTACT_US",
  "DOWNLOAD",
];

const QUESTION_VALUES: LeadQuestionType[] = [
  "FULL_NAME",
  "FIRST_NAME",
  "LAST_NAME",
  "EMAIL",
  "PHONE",
  "CITY",
  "COMPANY_NAME",
];

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["campaignName", "copy", "targeting", "leadForm", "imageColors"],
  properties: {
    campaignName: { type: "string" },
    copy: {
      type: "object",
      additionalProperties: false,
      required: ["primaryText", "headline", "description", "callToAction"],
      properties: {
        primaryText: { type: "string" },
        headline: { type: "string" },
        description: { type: "string" },
        callToAction: { type: "string", enum: CTA_VALUES },
      },
    },
    targeting: {
      type: "object",
      additionalProperties: false,
      required: ["countries", "ageMin", "ageMax", "genders"],
      properties: {
        countries: { type: "array", items: { type: "string" } },
        ageMin: { type: "integer" },
        ageMax: { type: "integer" },
        genders: {
          type: "array",
          items: { type: "string", enum: ["male", "female"] },
        },
      },
    },
    leadForm: {
      type: "object",
      additionalProperties: false,
      required: ["name", "intro", "questions", "thankYou"],
      properties: {
        name: { type: "string" },
        intro: {
          type: "object",
          additionalProperties: false,
          required: ["headline", "description"],
          properties: {
            headline: { type: "string" },
            description: { type: "string" },
          },
        },
        questions: {
          type: "array",
          items: { type: "string", enum: QUESTION_VALUES },
        },
        thankYou: {
          type: "object",
          additionalProperties: false,
          required: ["title", "body"],
          properties: {
            title: { type: "string" },
            body: { type: "string" },
          },
        },
      },
    },
    imageColors: {
      type: "object",
      additionalProperties: false,
      required: ["background", "text", "accent"],
      properties: {
        background: { type: "string" },
        text: { type: "string" },
        accent: { type: "string" },
      },
    },
  },
};

const SYSTEM_PROMPT = `אתה מנהל שיווק דיגיטלי (Performance Marketing) מומחה לפרסום ממומן בפייסבוק ואינסטגרם בישראל.
מהבקשה החופשית של המשתמש/ת, הפק בריף מלא למודעת לידים אחת.

הנחיות:
- כתוב את כל הטקסטים בעברית תקינה וזורמת, בפנייה מתאימה לקהל היעד.
- primaryText: 1-3 משפטים מזמינים עם קריאה לפעולה, אימוג'י אחד-שניים במידה.
- headline: קצר וקולע (עד ~5 מילים).
- description: שורת משנה קצרה (הטבה/יתרון).
- עמוד בכללי הפרסום של Meta: בלי הבטחות מוגזמות, בלי טענות בריאותיות/רפואיות, בלי אפליה, בלי "מובטח".
- אל תתייחס למאפיינים אישיים בגוף פנייה ישיר ("אתה שסובל מ...") — אסור ב-Meta.
- targeting: הסק קהל סביר מהבקשה. genders: השאר ריק [] אם לא צוין מגדר. countries ברירת מחדל ["IL"].
- questions: בחר שדות רלוונטיים לטופס (ברירת מחדל FULL_NAME, EMAIL, PHONE).
- imageColors: בחר פלטת צבעים (hex) שמתאימה למותג/למצב הרוח של המודעה, עם ניגודיות טובה בין text ל-background.
- החזר JSON בלבד לפי הסכימה.`;

/** Turns a free-form Hebrew request into structured brief content via Claude. */
export function generateBriefContent(
  opts: AnthropicOptions,
  request: string,
): Promise<BriefContent> {
  return generateJson<BriefContent>(opts, SYSTEM_PROMPT, request, SCHEMA);
}
