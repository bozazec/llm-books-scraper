import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import { wrap, configure } from "agentql";
import { chromium } from "playwright";

// Initialize environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

console.log("Server starting...");

// Configure AgentQL
configure({
  apiKey: process.env.AGENTQL_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

const QUERY = `
  {
      books[] {
          name
          price
          rating
      }
  }
`;

async function scrapeBooks(url) {
  console.log(`\n🚀 Starting scraping for URL: ${url}`);
  let browser = null;
  try {
    console.log("📱 Launching browser...");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await wrap(await context.newPage());

    console.log("🌐 Navigating to URL...");
    await page.goto(url);
    const books = [];
    let retryCount = 0;
    const maxRetries = 3;
    let pageNumber = 1;

    while (books.length < 50 && retryCount < maxRetries) {
      try {
        console.log(`\n📖 Scraping page ${pageNumber}...`);
        const response = await page.queryData(QUERY);

        if (response.books && response.books.length > 0) {
          const newBooks =
            response.books.length + books.length > 50
              ? response.books.slice(0, 50 - books.length)
              : response.books;

          books.push(...newBooks);
          console.log(
            `✅ Found ${newBooks.length} books on page ${pageNumber}`
          );
          console.log(`📚 Total books collected: ${books.length}/50`);
        } else {
          console.log("⚠️ No books found on this page");
        }

        if (books.length >= 50) {
          console.log("🎉 Reached target number of books!");
          break;
        }

        console.log("🔍 Checking for next page...");
        const hasNextPage = await goToTheNextPage(page, url);
        if (!hasNextPage) {
          console.log("📌 No more pages available");
          break;
        }
        pageNumber++;
      } catch (error) {
        console.error(
          `❌ Error during scraping (attempt ${retryCount + 1}/${maxRetries}):`,
          error
        );
        retryCount++;
        if (retryCount >= maxRetries) {
          console.error("🚫 Maximum retry attempts reached");
          throw new Error("Maximum retry attempts reached");
        }
        console.log(`⏳ Waiting ${retryCount} second(s) before retry...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      }
    }

    console.log(
      `\n✨ Scraping completed! Collected ${books.length} books total`
    );
    return books;
  } finally {
    if (browser) {
      console.log("🔒 Closing browser...");
      await browser.close().catch(console.error);
    }
  }
}

async function goToTheNextPage(page, URL) {
  const nextPageQuery = `
    {
        pagination {
            prev_page_url
            next_page_url
        }
    }`;

  try {
    const pagination = await page.queryData(nextPageQuery);
    let nextPageUrl = pagination.pagination?.next_page_url;

    if (!nextPageUrl) {
      return false;
    }

    if (!nextPageUrl.startsWith("http")) {
      nextPageUrl = URL + nextPageUrl;
    }
    console.log(`🔄 Navigating to next page: ${nextPageUrl}`);
    await page.goto(nextPageUrl);
    return true;
  } catch (error) {
    console.error("❌ Navigation error:", error);
    return false;
  }
}

// API endpoint for scraping
app.post("/api/scrape", async (req, res) => {
  console.log("\n📨 Received scraping request");
  try {
    const { url } = req.body;

    if (!url) {
      console.error("❌ No URL provided");
      return res.status(400).json({ error: "URL is required" });
    }

    const books = await scrapeBooks(url);

    if (books.length === 0) {
      console.warn("⚠️ No books found");
      return res.status(404).json({ error: "No books found" });
    }

    console.log(`✅ Successfully returned ${books.length} books`);
    res.json(books);
  } catch (error) {
    console.error("❌ Server error:", error);
    res.status(500).json({
      error: "Failed to scrape data",
      message: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
