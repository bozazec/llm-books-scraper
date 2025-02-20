const { wrap, configure } = require("agentql");
const { chromium } = require("playwright");

configure({
  apiKey: process.env.AGENTQL_API_KEY,
});

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
  const books = [];
  const browser = await chromium.launch({ headless: true });
  const page = await wrap(await browser.newPage());

  try {
    await page.goto(url);

    while (books.length < 50) {
      const response = await page.queryData(QUERY);

      if (response.books.length + books.length > 50) {
        books.push(...response.books.slice(0, 50 - books.length));
      } else {
        books.push(...response.books);
      }

      const hasNextPage = await goToTheNextPage(page, url);
      if (!hasNextPage) break;
    }
  } finally {
    await browser.close();
  }

  return books;
}

async function goToTheNextPage(page, URL) {
  const nextPageQuery = `
    {
        pagination {
            prev_page_url
            next_page_url
        }
    }`;

  const pagination = await page.queryData(nextPageQuery);
  let nextPageUrl = pagination.pagination?.next_page_url;

  if (!nextPageUrl) {
    return false;
  }

  try {
    if (!nextPageUrl.startsWith("http")) {
      nextPageUrl = URL + nextPageUrl;
    }
    await page.goto(nextPageUrl);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

module.exports = { scrapeBooks };
