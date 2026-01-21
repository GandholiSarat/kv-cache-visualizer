import { tokenizePrompt } from "./promptUtils";

export interface SinglePromptState {
	promptText: string;
	tokens: string[];
	currentIndex: number;
}

export function createSinglePromptState(promptText: string): SinglePromptState {
	return {
		promptText,
		tokens: tokenizePrompt(promptText),
		currentIndex: 0,
	};
}

export function isSinglePromptConsumed(state: SinglePromptState): boolean {
	return state.currentIndex >= state.tokens.length;
}
