import { ObjectId } from "mongodb";

class UserDTO {
  constructor(user) {
    this._id = new ObjectId(),
    this.email = user.email;
    this.name = user.name;
    this.role = user.role || 'user';
    this.phone = user.phone || null;
    this.country = user.country || null;
    this.avatarUrl = user.avatarUrl || null;
    this.createdAt = user.createdAt;
    this.banned = user.banned ?? false;
    this.preferences = user.preferences || {
      marketingEmails: false,
      personalizedRecs: true,
      shareAnonymized: false,
      dataRetentionMonths: null
    };
    this.lists = user.lists || [];
  }

  static createFromData(userData) {
    return {
      _id: userData._id || new ObjectId(),
      email: userData.email,
      passwordHash: userData.passwordHash,
      role: userData.role || 'user',
      name: userData.name ?? null,
      phone: userData.phone ?? null,
      country: userData.country ?? null,
      avatarUrl: userData.avatarUrl ?? "",
      createdAt: new Date(),
      banned: userData.banned ?? false,
      preferences: userData.preferences || {
        marketingEmails: false,
        personalizedRecs: true,
        shareAnonymized: false
      },
      lists: userData.lists || []
    };
  }
  

  toResponse() {
    return {
      _id: this._id,
      email: this.email,
      name: this.name,
      role: this.role,
      phone: this.phone,
      country: this.country,
      avatarUrl: this.avatarUrl,
      createdAt: this.createdAt,
      banned: this.banned,
      preferences: this.preferences,
      lists: this.lists
    };
  }
}

export default UserDTO