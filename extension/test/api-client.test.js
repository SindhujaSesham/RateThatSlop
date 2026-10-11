import assert from "node:assert/strict";
import test from "node:test";
import { createApiClient } from "../src/background/api-client.js";

test("description evaluation forwards scraped listing details without image data", async () => {
	let requestUrl;
	let requestOptions;
	const client = createApiClient({
		baseUrl: "https://api.example.test",
		getToken: async () => "session-token",
		fetchImpl: async (url, options) => {
			requestUrl = url;
			requestOptions = options;
			return { ok: true, json: async () => ({ classification: "indeterminate" }) };
		},
	});
	const listingDetails = {
		title: "Linen shirt pattern",
		price: "$8.00",
		instructions: "Print at 100%",
		attributes: "Sizes XS-XL",
	};

	await client.evaluateDescription("A sewing pattern description", listingDetails);

	assert.equal(requestUrl, "https://api.example.test/api/evaluate-description");
	assert.deepEqual(JSON.parse(requestOptions.body), {
		description: "A sewing pattern description",
		listingDetails,
	});
	assert.equal(requestOptions.headers.Authorization, "Bearer session-token");
	assert.equal(requestOptions.body.includes("imageData"), false);
});