import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Fetch the page content
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch page: ${response.statusText}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const isWisdomLib = parsedUrl.hostname.includes('wisdomlib.org');

    let title = $('title').text().trim();
    let bookTitle = '';
    let chapterTitle = '';
    let content = '';
    let footnotes = '';

    if (isWisdomLib) {
      // 1. Book Title
      // Often found in metadata: <meta property="book:title"> or <h1 itemprop="name"> or breadcrumbs
      const metaBookTitle = $('meta[property="book:title"]').attr('content');
      const h1Name = $('h1[itemprop="name"]').text().trim();
      
      // Look at breadcrumbs or headers
      const breadcrumbs: string[] = [];
      $('.chapter_detail nav a, .breadcrumb a').each((_, el) => {
        breadcrumbs.push($(el).text().trim());
      });

      bookTitle = metaBookTitle || h1Name || breadcrumbs[breadcrumbs.length - 2] || 'WisdomLib Book';
      
      // 2. Chapter Title / Lecture
      // Typically the last breadcrumb or the title of the current page
      const currentChapterLinkText = $('.chapter_detail nav span.active, .breadcrumb span.active').text().trim();
      chapterTitle = currentChapterLinkText || title.split('|')[0].trim();
      
      // If we couldn't get book/chapter cleanly, let's extract from JSON-LD schema if available
      const jsonLdScript = $('script[type="application/ld+json"]').html();
      if (jsonLdScript) {
        try {
          const jsonLd = JSON.parse(jsonLdScript);
          if (jsonLd['@type'] === 'BreadcrumbList' && Array.isArray(jsonLd.itemListElement)) {
            const items = jsonLd.itemListElement;
            if (items.length >= 2) {
              bookTitle = items[items.length - 2]?.item?.name || bookTitle;
              chapterTitle = items[items.length - 1]?.item?.name || chapterTitle;
            }
          }
        } catch (e) {
          // Ignore json-ld parse errors
        }
      }

      // 3. Extract Main Content (typically inside #scontent)
      const contentContainer = $('#scontent');
      if (contentContainer.length > 0) {
        // Extract footnotes section first if it exists
        const footnotesContainer = contentContainer.find('section.footnotes');
        if (footnotesContainer.length > 0) {
          footnotes = footnotesContainer.text().trim();
          // Remove footnotes from main content to avoid duplicates
          footnotesContainer.remove();
        }

        // Get main content text (keeping paragraphs separate for better formatting)
        const paragraphs: string[] = [];
        contentContainer.find('p').each((_, el) => {
          const pText = $(el).text().trim();
          if (pText) {
            paragraphs.push(pText);
          }
        });
        
        content = paragraphs.join('\n\n');
        
        // If content is still empty, get the whole text of the container
        if (!content) {
          content = contentContainer.text().trim();
        }
      } else {
        // Fallback if #scontent is not found
        content = $('.chapter-content').text().trim() || $('article').text().trim() || $('main').text().trim();
      }
    } else {
      // Generic scraping for other sites
      // Remove noisy elements
      $('script, style, nav, footer, header, iframe, noscript, .ads, #ads').remove();

      // Look for standard article tags
      const possibleContainers = ['article', 'main', '[role="main"]', '#content', '.content', '.post', '.entry-content'];
      let targetContainer = null;
      
      for (const selector of possibleContainers) {
        const el = $(selector);
        if (el.length > 0 && el.text().trim().length > 200) {
          targetContainer = el;
          break;
        }
      }

      if (targetContainer) {
        const paragraphs: string[] = [];
        targetContainer.find('p, h1, h2, h3, h4, h5, h6, li').each((_, el) => {
          const text = $(el).text().trim();
          if (text) paragraphs.push(text);
        });
        content = paragraphs.join('\n\n');
      } else {
        // Ultimate fallback: body text
        content = $('body').text().trim().replace(/\s+/g, ' ');
      }
      
      bookTitle = title || 'General Webpage';
      chapterTitle = 'Webpage Content';
    }

    // Clean up content slightly (limit length if too huge to avoid Gemini context limits, though Flash handles 1M)
    if (content.length > 50000) {
      content = content.slice(0, 50000) + '\n\n[Content truncated due to length...]';
    }

    return NextResponse.json({
      success: true,
      url,
      title,
      bookTitle,
      chapterTitle,
      content: content.trim(),
      footnotes: footnotes.trim()
    });
  } catch (error: any) {
    console.error('Scrape API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal scraping error' },
      { status: 500 }
    );
  }
}
