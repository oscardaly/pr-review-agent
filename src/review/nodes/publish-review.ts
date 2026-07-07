import type { ReviewGraphDependencies } from "../dependencies";
import {
  renderReviewMarkdown,
  renderReviewSummaryMarkdown,
} from "../render-review";
import type { ReviewState, ReviewStateUpdate } from "../state";

export const makeReviewPublisher =
  (deps: ReviewGraphDependencies) =>
  async (state: ReviewState): Promise<ReviewStateUpdate> => {
    const { url } = await deps.github.postReview({
      prNumber: state.pr.number,
      markdown: renderReviewMarkdown(state),
      summaryMarkdown: renderReviewSummaryMarkdown(state),
      comments: state.validatedComments,
    });
    return { reviewUrl: url };
  };
