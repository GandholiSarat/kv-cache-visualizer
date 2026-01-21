import { flattenPrefillStream, tokenizePrompt, type FlatToken } from "./promptUtils";

export interface MultiPromptState {
	promptCount: number;
	prompts: string[];
	promptTokens: string[][];
	prefillStream: FlatToken[];
	prefillIndex: number;
	decodeSteps: number;
}

export function createMultiPromptState(promptCount: number, prompts: string[]): MultiPromptState {
	const activePrompts = prompts.slice(0, promptCount);
	const promptTokens = activePrompts.map(tokenizePrompt);
	return {
		promptCount,
		prompts,
		promptTokens,
		prefillStream: flattenPrefillStream(promptTokens),
		prefillIndex: 0,
		decodeSteps: 0,
	};
}
