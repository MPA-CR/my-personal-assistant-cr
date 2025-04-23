import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, loginSchema, 
  insertServiceCategorySchema, insertServiceSchema, 
  insertBookingSchema, insertReviewSchema,
  insertMessageSchema
} from "@shared/schema";
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import MemoryStore from "memorystore";

export async function registerRoutes(app: Express): Promise<Server> {
  // Session setup
  const MemoryStoreSession = MemoryStore(session);
  
  app.use(session({
    secret: process.env.SESSION_SECRET || 'my-personal-assistant-cr-secret',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStoreSession({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    cookie: { 
      maxAge: 86400000, // 24 hours
      secure: process.env.NODE_ENV === 'production'
    }
  }));
  
  // Passport authentication setup
  app.use(passport.initialize());
  app.use(passport.session());
  
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return done(null, false, { message: 'Invalid username or password' });
      }
      if (user.password !== password) { // In a real app, use proper password hashing
        return done(null, false, { message: 'Invalid username or password' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
  
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
  
  // Middleware to check if user is authenticated
  const isAuthenticated = (req: Request, res: Response, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
  };
  
  // Middleware to check if user is admin
  const isAdmin = (req: Request, res: Response, next: any) => {
    if (req.isAuthenticated() && req.user && (req.user as any).role === 'admin') {
      return next();
    }
    res.status(403).json({ message: 'Forbidden' });
  };
  
  // Auth Routes
  app.get('/api/auth/me', async (req, res) => {
    if (req.isAuthenticated()) {
      const { password, ...userInfo } = req.user as any;
      res.json(userInfo);
    } else {
      res.status(401).json({ message: 'Unauthorized' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username or email already exists
      const existingUsername = await storage.getUserByUsername(userData.username);
      if (existingUsername) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      
      const newUser = await storage.createUser(userData);
      res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role
      });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });
  
  app.post('/api/auth/login', (req, res, next) => {
    try {
      const loginData = loginSchema.parse(req.body);
      
      passport.authenticate('local', (err: Error, user: any, info: any) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ message: info.message });
        
        req.logIn(user, (err) => {
          if (err) return next(err);
          return res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role
          });
        });
      })(req, res, next);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });
  
  app.get('/api/auth/logout', (req, res) => {
    if (req.isAuthenticated()) {
      req.logout((err) => {
        if (err) {
          return res.status(500).json({ message: 'Logout failed' });
        }
        res.json({ message: 'Logged out successfully' });
      });
    } else {
      res.json({ message: 'Not logged in' });
    }
  });
  
  // This endpoint is now replaced by the non-authenticated version above
  
  // User Routes
  app.get('/api/users/:id', async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Don't expose password
      const { password, ...userInfo } = user;
      res.json(userInfo);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.patch('/api/users/:id', isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUser = req.user as any;
      
      // Users can only update their own profile unless they are admins
      if (userId !== currentUser.id && currentUser.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const updatedUser = await storage.updateUser(userId, req.body);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Don't expose password
      const { password, ...userInfo } = updatedUser;
      res.json(userInfo);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });
  
  app.get('/api/assistants/nearby', async (req, res) => {
    try {
      const { lat, lng, radius } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ message: 'Location coordinates required' });
      }
      
      const location = {
        lat: parseFloat(lat as string),
        lng: parseFloat(lng as string)
      };
      
      const radiusInKm = radius ? parseFloat(radius as string) : 10;
      
      const assistants = await storage.getNearbyAssistants(location, radiusInKm);
      
      // Don't expose passwords
      const assistantsInfo = assistants.map(assistant => {
        const { password, ...info } = assistant;
        return info;
      });
      
      res.json(assistantsInfo);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Service Category Routes
  app.get('/api/service-categories', async (req, res) => {
    try {
      const categories = await storage.getServiceCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.post('/api/service-categories', isAdmin, async (req, res) => {
    try {
      const categoryData = insertServiceCategorySchema.parse(req.body);
      const newCategory = await storage.createServiceCategory(categoryData);
      res.status(201).json(newCategory);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });
  
  app.patch('/api/service-categories/:id', isAdmin, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const updatedCategory = await storage.updateServiceCategory(categoryId, req.body);
      
      if (!updatedCategory) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      res.json(updatedCategory);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });
  
  app.delete('/api/service-categories/:id', isAdmin, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const result = await storage.deleteServiceCategory(categoryId);
      
      if (!result) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Services Routes
  app.get('/api/services', async (req, res) => {
    try {
      const assistantId = req.query.assistantId;
      const categoryId = req.query.categoryId;
      
      let services;
      
      if (assistantId) {
        services = await storage.getServicesByAssistantId(parseInt(assistantId as string));
      } else if (categoryId) {
        services = await storage.getServicesByCategoryId(parseInt(categoryId as string));
      } else {
        services = await storage.getServices();
      }
      
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.get('/api/services/:id', async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const service = await storage.getService(serviceId);
      
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }
      
      res.json(service);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.post('/api/services', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      
      // Only assistants can create services
      if (currentUser.role !== 'assistant' && currentUser.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden - Only assistants can create services' });
      }
      
      const serviceData = insertServiceSchema.parse(req.body);
      
      // If not admin, ensure assistantId matches current user
      if (currentUser.role !== 'admin' && serviceData.assistantId !== currentUser.id) {
        return res.status(403).json({ message: 'Forbidden - Cannot create services for other assistants' });
      }
      
      const newService = await storage.createService(serviceData);
      res.status(201).json(newService);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });
  
  app.patch('/api/services/:id', isAuthenticated, async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const currentUser = req.user as any;
      
      const service = await storage.getService(serviceId);
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }
      
      // Check if user is allowed to update this service
      if (currentUser.role !== 'admin' && service.assistantId !== currentUser.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const updatedService = await storage.updateService(serviceId, req.body);
      res.json(updatedService);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });
  
  app.delete('/api/services/:id', isAuthenticated, async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const currentUser = req.user as any;
      
      const service = await storage.getService(serviceId);
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }
      
      // Check if user is allowed to delete this service
      if (currentUser.role !== 'admin' && service.assistantId !== currentUser.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const result = await storage.deleteService(serviceId);
      res.json({ message: 'Service deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Booking Routes
  app.get('/api/bookings', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      
      let bookings;
      
      if (currentUser.role === 'admin') {
        bookings = await storage.getBookings();
      } else if (currentUser.role === 'assistant') {
        bookings = await storage.getBookingsByAssistantId(currentUser.id);
      } else {
        bookings = await storage.getBookingsByClientId(currentUser.id);
      }
      
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.get('/api/bookings/:id', isAuthenticated, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const currentUser = req.user as any;
      
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      // Check if user is allowed to view this booking
      if (
        currentUser.role !== 'admin' && 
        booking.clientId !== currentUser.id && 
        booking.assistantId !== currentUser.id
      ) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      res.json(booking);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.post('/api/bookings', isAuthenticated, async (req, res) => {
    try {
      const bookingData = insertBookingSchema.parse(req.body);
      const currentUser = req.user as any;
      
      // Regular users can only book for themselves
      if (currentUser.role !== 'admin' && bookingData.clientId !== currentUser.id) {
        return res.status(403).json({ message: 'Forbidden - Cannot create bookings for other users' });
      }
      
      // Check if service exists
      const service = await storage.getService(bookingData.serviceId);
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }
      
      // Check if assistant exists
      const assistant = await storage.getUser(bookingData.assistantId);
      if (!assistant || assistant.role !== 'assistant') {
        return res.status(404).json({ message: 'Assistant not found' });
      }
      
      const newBooking = await storage.createBooking(bookingData);
      res.status(201).json(newBooking);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });
  
  app.patch('/api/bookings/:id', isAuthenticated, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const currentUser = req.user as any;
      
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      // Check if user is allowed to update this booking
      if (
        currentUser.role !== 'admin' && 
        booking.clientId !== currentUser.id && 
        booking.assistantId !== currentUser.id
      ) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Client can only cancel, assistant can confirm/complete
      if (currentUser.role !== 'admin') {
        const allowedStatusChanges: Record<string, string[]> = {
          client: ['cancelled'],
          assistant: ['confirmed', 'completed', 'cancelled']
        };
        
        const userType = booking.clientId === currentUser.id ? 'client' : 'assistant';
        
        if (
          req.body.status && 
          req.body.status !== booking.status && 
          !allowedStatusChanges[userType].includes(req.body.status)
        ) {
          return res.status(403).json({ 
            message: `${userType} cannot change booking status to ${req.body.status}` 
          });
        }
      }
      
      const updatedBooking = await storage.updateBooking(bookingId, req.body);
      res.json(updatedBooking);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });
  
  // Review Routes
  app.get('/api/reviews/:assistantId', async (req, res) => {
    try {
      const assistantId = parseInt(req.params.assistantId);
      const reviews = await storage.getReviewsByAssistantId(assistantId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.post('/api/reviews', isAuthenticated, async (req, res) => {
    try {
      const reviewData = insertReviewSchema.parse(req.body);
      const currentUser = req.user as any;
      
      // Regular users can only post reviews as themselves
      if (currentUser.role !== 'admin' && reviewData.clientId !== currentUser.id) {
        return res.status(403).json({ message: 'Forbidden - Cannot post reviews as other users' });
      }
      
      // Verify the booking exists and is completed
      const booking = await storage.getBooking(reviewData.bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      if (booking.status !== 'completed') {
        return res.status(400).json({ message: 'Cannot review incomplete bookings' });
      }
      
      if (booking.clientId !== reviewData.clientId || booking.assistantId !== reviewData.assistantId) {
        return res.status(400).json({ message: 'Review details do not match booking' });
      }
      
      const newReview = await storage.createReview(reviewData);
      res.status(201).json(newReview);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });
  
  // Message Routes
  app.get('/api/messages/:userId', isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const currentUser = req.user as any;
      
      // Users can only view their own conversations
      if (currentUser.role !== 'admin' && currentUser.id !== userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const otherUserId = parseInt(req.query.otherUserId as string);
      
      if (!otherUserId) {
        return res.status(400).json({ message: 'otherUserId query parameter required' });
      }
      
      const messages = await storage.getMessagesBetweenUsers(userId, otherUserId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.post('/api/messages', isAuthenticated, async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const currentUser = req.user as any;
      
      // Users can only send messages as themselves
      if (currentUser.role !== 'admin' && messageData.senderId !== currentUser.id) {
        return res.status(403).json({ message: 'Forbidden - Cannot send messages as other users' });
      }
      
      // Check if receiver exists
      const receiver = await storage.getUser(messageData.receiverId);
      if (!receiver) {
        return res.status(404).json({ message: 'Receiver not found' });
      }
      
      const newMessage = await storage.createMessage(messageData);
      res.status(201).json(newMessage);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });
  
  app.patch('/api/messages/:id/read', isAuthenticated, async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      const currentUser = req.user as any;
      
      // Get the message
      const message = await storage.getMessages().then(messages => 
        messages.find(m => m.id === messageId)
      );
      
      if (!message) {
        return res.status(404).json({ message: 'Message not found' });
      }
      
      // Users can only mark messages sent to them as read
      if (currentUser.role !== 'admin' && message.receiverId !== currentUser.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const updatedMessage = await storage.markMessageAsRead(messageId);
      res.json(updatedMessage);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
