import type { ReviewGraphDependencies } from "../dependencies";
import { renderReviewMarkdown } from "../render-review";
import type { ReviewState, ReviewStateUpdate } from "../state";

export const makeReviewPublisher =
  (deps: ReviewGraphDependencies) =>
  async (state: ReviewState): Promise<ReviewStateUpdate> => {
    const markdown = renderReviewMarkdown(state);
    const { url } = await deps.github.postReview({
      prNumber: state.pr.number,
      markdown,
      comments: state.validatedComments,
    });
    return { reviewUrl: url };
  };
