import { useState } from "react";
import "./App.css";

interface Book {
  name: string;
  price: number;
  rating: string;
}

function App() {
  const [url, setUrl] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScrape = async () => {
    if (!url) {
      setError("Please enter a URL");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/scrape`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const data = await response.json();
      setBooks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Book Scraper</h1>

      <div className="input-group">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL to scrape"
          className="url-input"
        />
        <button
          onClick={handleScrape}
          disabled={isLoading}
          className="scrape-button"
        >
          {isLoading ? "Scraping..." : "RUN"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {books.length > 0 && (
        <div className="results">
          <h2>Results:</h2>
          <div className="books-grid">
            {books.map((book, index) => (
              <div key={index} className="book-card">
                <h3>{book.name}</h3>
                <p>Price: ${book.price}</p>
                <p>Rating: {book.rating}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
