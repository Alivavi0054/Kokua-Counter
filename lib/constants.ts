import "server-only";
import { z } from "zod";
export * from "@/lib/public-constants";

const dailyLimitsSchema = z.object({
	MEALS_PER_DAY: z.coerce.number().int().min(1).max(10),
	PASSES_GENERATED_PER_DAY: z.coerce.number().int().min(1).max(20),
	EATERY_DAILY_LIMIT: z.coerce.number().int().min(1).max(10_000),
});

export function getServerDailyLimits() {
	const parsed = dailyLimitsSchema.safeParse({
		MEALS_PER_DAY: process.env.MEALS_PER_DAY ?? "1",
		PASSES_GENERATED_PER_DAY: process.env.PASSES_GENERATED_PER_DAY ?? "3",
		EATERY_DAILY_LIMIT: process.env.EATERY_DAILY_LIMIT ?? "200",
	});

	if (!parsed.success) {
		const invalid = parsed.error.issues
			.map((issue) => String(issue.path[0]))
			.filter((name, index, names) => names.indexOf(name) === index);
		throw new Error(`Invalid daily limit configuration: ${invalid.join(", ")} in lib/constants.ts.`);
	}

	return parsed.data;
}
