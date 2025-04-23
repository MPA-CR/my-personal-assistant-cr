import { 
  users, User, InsertUser, 
  serviceCategories, ServiceCategory, InsertServiceCategory,
  services, Service, InsertService,
  bookings, Booking, InsertBooking,
  reviews, Review, InsertReview,
  messages, Message, InsertMessage,
  Location
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  getNearbyAssistants(location: Location, radius: number): Promise<User[]>;
  
  // Service Category operations
  getServiceCategories(): Promise<ServiceCategory[]>;
  getServiceCategory(id: number): Promise<ServiceCategory | undefined>;
  createServiceCategory(category: InsertServiceCategory): Promise<ServiceCategory>;
  updateServiceCategory(id: number, category: Partial<ServiceCategory>): Promise<ServiceCategory | undefined>;
  deleteServiceCategory(id: number): Promise<boolean>;
  
  // Service operations
  getServices(): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  getServicesByAssistantId(assistantId: number): Promise<Service[]>;
  getServicesByCategoryId(categoryId: number): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<Service>): Promise<Service | undefined>;
  deleteService(id: number): Promise<boolean>;
  
  // Booking operations
  getBookings(): Promise<Booking[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingsByClientId(clientId: number): Promise<Booking[]>;
  getBookingsByAssistantId(assistantId: number): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: number, booking: Partial<Booking>): Promise<Booking | undefined>;
  
  // Review operations
  getReviewsByAssistantId(assistantId: number): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  
  // Message operations
  getMessagesBetweenUsers(userId1: number, userId2: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<Message | undefined>;
}

// Helper functions
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Haversine formula to calculate distance between two points on Earth
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private serviceCategories: Map<number, ServiceCategory>;
  private services: Map<number, Service>;
  private bookings: Map<number, Booking>;
  private reviews: Map<number, Review>;
  private messages: Map<number, Message>;
  
  private currentUserId: number;
  private currentServiceCategoryId: number;
  private currentServiceId: number;
  private currentBookingId: number;
  private currentReviewId: number;
  private currentMessageId: number;

  constructor() {
    this.users = new Map();
    this.serviceCategories = new Map();
    this.services = new Map();
    this.bookings = new Map();
    this.reviews = new Map();
    this.messages = new Map();
    
    this.currentUserId = 1;
    this.currentServiceCategoryId = 1;
    this.currentServiceId = 1;
    this.currentBookingId = 1;
    this.currentReviewId = 1;
    this.currentMessageId = 1;
    
    // Initialize with some service categories
    this.initServiceCategories();
  }

  private initServiceCategories() {
    const categories = [
      { name: "Translator", icon: "ri-translate-2-line", description: "Language translation services" },
      { name: "Security", icon: "ri-shield-check-line", description: "Personal security and protection" },
      { name: "Tour Guide", icon: "ri-route-line", description: "Guided tours of local attractions" },
      { name: "Driver", icon: "ri-car-line", description: "Private transportation services" },
      { name: "Chef", icon: "ri-restaurant-line", description: "Personal chef for private cooking" },
      { name: "Childcare", icon: "ri-heart-line", description: "Babysitting and childcare services" }
    ];
    
    categories.forEach(category => {
      this.createServiceCategory(category as InsertServiceCategory);
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();
    const user: User = { ...insertUser, id, createdAt: now, lastActive: now };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData, lastActive: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getNearbyAssistants(location: Location, radius: number = 10): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(user => 
        user.role === 'assistant' && 
        user.location && 
        calculateDistance(
          location.lat, 
          location.lng, 
          (user.location as Location).lat, 
          (user.location as Location).lng
        ) <= radius
      )
      .sort((a, b) => {
        if (!a.location || !b.location) return 0;
        const distA = calculateDistance(
          location.lat, 
          location.lng, 
          (a.location as Location).lat, 
          (a.location as Location).lng
        );
        const distB = calculateDistance(
          location.lat, 
          location.lng, 
          (b.location as Location).lat, 
          (b.location as Location).lng
        );
        return distA - distB;
      });
  }

  // Service Category operations
  async getServiceCategories(): Promise<ServiceCategory[]> {
    return Array.from(this.serviceCategories.values());
  }

  async getServiceCategory(id: number): Promise<ServiceCategory | undefined> {
    return this.serviceCategories.get(id);
  }

  async createServiceCategory(category: InsertServiceCategory): Promise<ServiceCategory> {
    const id = this.currentServiceCategoryId++;
    const serviceCategory: ServiceCategory = { ...category, id };
    this.serviceCategories.set(id, serviceCategory);
    return serviceCategory;
  }

  async updateServiceCategory(id: number, categoryData: Partial<ServiceCategory>): Promise<ServiceCategory | undefined> {
    const category = this.serviceCategories.get(id);
    if (!category) return undefined;
    
    const updatedCategory = { ...category, ...categoryData };
    this.serviceCategories.set(id, updatedCategory);
    return updatedCategory;
  }

  async deleteServiceCategory(id: number): Promise<boolean> {
    return this.serviceCategories.delete(id);
  }

  // Service operations
  async getServices(): Promise<Service[]> {
    return Array.from(this.services.values());
  }

  async getService(id: number): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async getServicesByAssistantId(assistantId: number): Promise<Service[]> {
    return Array.from(this.services.values())
      .filter(service => service.assistantId === assistantId);
  }

  async getServicesByCategoryId(categoryId: number): Promise<Service[]> {
    return Array.from(this.services.values())
      .filter(service => service.categoryId === categoryId);
  }

  async createService(service: InsertService): Promise<Service> {
    const id = this.currentServiceId++;
    const newService: Service = { ...service, id };
    this.services.set(id, newService);
    return newService;
  }

  async updateService(id: number, serviceData: Partial<Service>): Promise<Service | undefined> {
    const service = this.services.get(id);
    if (!service) return undefined;
    
    const updatedService = { ...service, ...serviceData };
    this.services.set(id, updatedService);
    return updatedService;
  }

  async deleteService(id: number): Promise<boolean> {
    return this.services.delete(id);
  }

  // Booking operations
  async getBookings(): Promise<Booking[]> {
    return Array.from(this.bookings.values());
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }

  async getBookingsByClientId(clientId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values())
      .filter(booking => booking.clientId === clientId);
  }

  async getBookingsByAssistantId(assistantId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values())
      .filter(booking => booking.assistantId === assistantId);
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const id = this.currentBookingId++;
    const now = new Date();
    const newBooking: Booking = { ...booking, id, createdAt: now };
    this.bookings.set(id, newBooking);
    return newBooking;
  }

  async updateBooking(id: number, bookingData: Partial<Booking>): Promise<Booking | undefined> {
    const booking = this.bookings.get(id);
    if (!booking) return undefined;
    
    const updatedBooking = { ...booking, ...bookingData };
    this.bookings.set(id, updatedBooking);
    return updatedBooking;
  }

  // Review operations
  async getReviewsByAssistantId(assistantId: number): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .filter(review => review.assistantId === assistantId);
  }

  async createReview(review: InsertReview): Promise<Review> {
    const id = this.currentReviewId++;
    const now = new Date();
    const newReview: Review = { ...review, id, createdAt: now };
    this.reviews.set(id, newReview);
    
    // Update assistant's average rating
    const assistantReviews = await this.getReviewsByAssistantId(review.assistantId);
    const avgRating = assistantReviews.reduce((sum, r) => sum + r.rating, 0) / assistantReviews.length;
    await this.updateUser(review.assistantId, { avgRating });
    
    return newReview;
  }

  // Message operations
  async getMessagesBetweenUsers(userId1: number, userId2: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => 
        (message.senderId === userId1 && message.receiverId === userId2) ||
        (message.senderId === userId2 && message.receiverId === userId1)
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const now = new Date();
    const newMessage: Message = { ...message, id, createdAt: now };
    this.messages.set(id, newMessage);
    return newMessage;
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    
    const updatedMessage = { ...message, isRead: true };
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }
}

export const storage = new MemStorage();
