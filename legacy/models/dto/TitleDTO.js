import { ObjectId } from "mongodb";

class TitleDTO {
  constructor(data) {
    this.title = data.title;
    this.description = data.description;
    this.type = data.type;
    this.year = data.year;
    this.createdBy = data.createdBy instanceof ObjectId ? data.createdBy : new ObjectId(data.createdBy);
    this.categoriesIds = data.categoriesIds?.map(id => new ObjectId(id)) || [];
    this.posterUrl = data.posterUrl || "";
    this.author = data.author;
    this.createdAt = data.createdAt || new Date();
    this.likes = 1;
    this.dislikes = 1;
    this.ratingAvg = 1;
    this.ratingCount = 1;
    this.status = "pending";

    // Campos específicos para series o anime
    if (this.type === "tv" || this.type === "anime") {
      this.temps = data.temps || 1;
      this.eps = data.eps || 1;
    }
  }

  static fromRequest(data) {
    return new TitleDTO({
      ...data
    });
  }

  toResponse() {
    const response = { ...this };
    return response;
  }
}

export default TitleDTO;
