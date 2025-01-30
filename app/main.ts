import { Readability } from "jsr:@paoramen/cheer-reader";

import ollama from "npm:ollama";
import * as cheerio from "npm:cheerio@1.0.0";

const searchUrl = "https://searx.perennialte.ch/search"
const query = prompt("Please enter your search query:") || "";
const aiInstructions = prompt("AI Instructions:") || "";

console.log(`Query: ${query}`);
const urls = await getNewsUrls(query);
const alltexts = await getCleanedText(urls);
await answerQuery(query, alltexts);

async function getNewsUrls(query: string) {
	try {
    console.log(`${searchUrl}?q=${query}&language=en&time_range=&safesearch=0&theme=simple&format=json`)
		const searchResults = await fetch(`${searchUrl}?q=${query}&language=en&time_range=&safesearch=0&theme=simple&format=json`);
		
		const searchResultsJson = await searchResults.json();
		const urls = searchResultsJson.results
			.map((result) => result.url)
			.slice(0, 20); // number of urls to fetch
		return urls;
	} catch (error) {
		console.error('Search failed:', error);
		return [];
	}
}

async function getCleanedText(urls: string[]) {
	const texts = [];
	for await (const url of urls) {
		const getUrl = await fetch(url);
		console.log(`Fetching ${url}`);
		const html = await getUrl.text();
		const text = htmlToText(html);
		texts.push(`Source: ${url}\n${text}\n\n`);
	}
	return texts;
}

function htmlToText(html: string) {
	const $ = cheerio.load(html);

  // Thanks to the comment on the YouTube video from @eliaspereirah for suggesting 
  // using Mozilla Readability. I used a variant that made it easier to use with 
  // cheerio. Definitely simplifies things
		const text = new Readability($).parse();

  // What I had before

	// $("script, source, style, head, img, svg, a, form, link, iframe").remove();
	// $("*").removeClass();
	// $("*").each((_, el) => {
	// 	if (el.type === "tag" || el.type === "script" || el.type === "style") {
	// 		for (const attr of Object.keys(el.attribs || {})) {
	// 			if (attr.startsWith("data-")) {
	// 				$(el).removeAttr(attr);
	// 			}
	// 		}
	// 	}
	// });
	// const text = $("body").text().replace(/\s+/g, " ");

	return text.textContent;
}

async function answerQuery(query: string, texts: string[]) {
	const result = await ollama.generate({
		model: "0xroyce/plutus",
		prompt: `${query}. Summarize the information and provide an answer. Use only the information in the following articles an you financial and technical analysis skills to answer the question in easy language yet professionally. Reply in tables in the console for better readability. Give user clean answer from all sources and list each what each source says. In the end give your own advice and probabilities ${aiInstructions}: ${texts.join("\n\n")}`,
		stream: true,
		options: {
			num_ctx: 16000,
		},
	});
	for await (const chunk of result) {
		if (chunk.done !== true) {
			await Deno.stdout.write(new TextEncoder().encode(chunk.response));
		}
	}
}