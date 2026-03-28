import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  let body: { images: { base64: string; mimeType: string }[]; fields: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }

  const { images, fields } = body;
  if (!images || images.length === 0) {
    return NextResponse.json({ error: "画像データが必要です" }, { status: 400 });
  }

  const isMultiple = images.length > 1;

  const prompt = fields.trim()
    ? isMultiple
      ? `${images.length}枚の画像から以下の項目を抽出してください：${fields}

各画像ごとに「--- 画像1 ---」のように区切って出力してください。
各項目名: 値 の形式で記載し、見つからない場合は「不明」としてください。余分な説明は不要です。`
      : `この画像から以下の項目を抽出してください：${fields}

各項目名: 値 の形式で出力してください。見つからない場合は「不明」と記載してください。余分な説明は不要です。`
    : isMultiple
    ? `${images.length}枚の画像から重要な情報をすべて抽出してください。

各画像ごとに「--- 画像1 ---」のように区切って出力してください。
レシートなら：店舗名、日時、商品名と金額、合計金額、支払方法
名刺なら：氏名、会社名、役職、電話番号、メールアドレス、住所
その他：画像の種類を判定し重要情報をすべて抽出

各項目名: 値 の形式で記載してください。余分な説明は不要です。`
    : `この画像から重要な情報をすべて抽出してください。

レシート・領収書：店舗名、日時、商品名と金額、合計金額、支払方法
名刺：氏名、会社名、役職、電話番号、メールアドレス、住所
その他：画像の種類を判定し重要情報をすべて抽出

各項目名: 値 の形式で出力してください。余分な説明は不要です。`;

  const parts: object[] = [{ text: prompt }];
  for (const img of images) {
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
  }

  const requestBody = {
    contents: [{ parts }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  };

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message =
        (error as { error?: { message?: string } })?.error?.message ||
        `Gemini API エラー (${response.status})`;
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "抽出結果を取得できませんでした";

    return NextResponse.json({ result: text });
  } catch (err) {
    console.error("Gemini API error:", err);
    return NextResponse.json({ error: "Gemini APIの呼び出しに失敗しました" }, { status: 500 });
  }
}
