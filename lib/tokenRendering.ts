/**
 * Token rendering utility: handles spacing between tokens.
 * 
 * Rules:
 * - First token: render directly (no leading space)
 * - Word tokens: preceded by a space (unless first token)
 * - Punctuation tokens (.,?!:;): NO leading space (render directly after previous)
 */

const PUNCTUATION_TOKENS = new Set([".", ",", "?", "!", ":", ";"]);

export function isPunctuationToken(token: string): boolean {
	return PUNCTUATION_TOKENS.has(token);
}

export function renderTokensWithSpacing(tokens: string[]): string {
	if (tokens.length === 0) return "";
	
	let result = tokens[0]; // First token, no leading space
	
	for (let i = 1; i < tokens.length; i++) {
		const token = tokens[i];
		
		if (isPunctuationToken(token)) {
			// Punctuation: no leading space
			result += token;
		} else {
			// Word token: add leading space
			result += " " + token;
		}
	}
	
	return result;
}
