export interface ModelPricing {
    inputPer1M: number;
    outputPer1M: number;
}
export declare const MODEL_PRICING: Record<string, ModelPricing>;
export declare function calculateCost(model: string, inputTokens: number, outputTokens: number): number;
