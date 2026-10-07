class ReviewDTO {
  constructor(review) {
    this.title = review.title,
    this.titleId = review.titleId;
    this.userId = review.userId;
    this.comment = review.comment;
    this.score = review.score;
    this.likesCount = review.likesCount || 0;
    this.dislikesCount = review.dislikesCount || 0;
    this.createdAt = review.createdAt || new Date();
  }

  static createFromData(reviewData) {
    return {
      title: reviewData.title,
      titleId: reviewData.titleId,
      userId: reviewData.userId,
      comment: reviewData.comment,
      score: reviewData.score,
      likesCount: 0,
      dislikesCount: 0,
      createdAt: new Date()
    };
  }

  toResponse() {
    return {
      title: this.title,
      titleId: this.titleId,
      userId: this.userId,
      comment: this.comment,
      score: this.score,
      likesCount: this.likesCount,
      dislikesCount: this.dislikesCount,
      createdAt: this.createdAt
    };
  }
}

export default ReviewDTO;
