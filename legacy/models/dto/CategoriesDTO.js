class CategoriesDTO {
  constructor(categories) {
    this.name = categories.name;
    this.createdAt = categories.createdAt;
  }

  static createFromDataCategories(categoriesData) {
    return {
      name : categoriesData.name,
      createdAt : new Date()
    };
  }

  toResponse() {
    const response = {
      name : this.name,
      createdAt : this.createdAt
    };
    return response;
  }
}

export default CategoriesDTO;