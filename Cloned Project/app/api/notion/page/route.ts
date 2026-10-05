import { NextRequest, NextResponse } from "next/server";
import { NotionAPI } from "notion-client";
import { parsePageId } from "notion-utils";

export const runtime = "nodejs";

function getNotionClient() {
    const authToken = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
    return new NotionAPI(authToken ? { authToken } : undefined);
}

export async function GET(req: NextRequest) {
    const pageUrl = req.nextUrl.searchParams.get("url");
    if (!pageUrl) {
        return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const pageId = parsePageId(pageUrl);
    if (!pageId) {
        return NextResponse.json({ error: "Could not parse a Notion page ID from that URL." }, { status: 400 });
    }

    try {
        const notion = getNotionClient();
        const recordMap = await notion.getPage(pageId);
        return NextResponse.json({ recordMap, pageId });
    } catch (error) {
        console.error("[Notion API] getPage failed:", error);
        return NextResponse.json(
            {
                error:
                    "Could not load this Notion page. Share the page with your Notion integration, or publish it to the web.",
            },
            { status: 502 },
        );
    }
}
