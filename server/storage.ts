import { db } from "./db";
import { eq, and, gte, lte, like } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { 
  users, 
  products, 
  categories, 
  cartItems, 
  orders, 
  orderItems, 
  customOrderRequests 
} from "@shared/schema";
import type { 
  User, 
  InsertUser, 
  Product, 
  InsertProduct, 
  Category, 
  InsertCategory, 
  CartItem, 
  InsertCartItem, 
  Order, 
  InsertOrder, 
  OrderItem, 
  InsertOrderItem,
  CustomOrderRequest,
  InsertCustomOrderRequest
} from "@shared/schema";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;

  // Category operations
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<Category>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;

  // Product operations
  getProducts(filters?: { 
    categoryId?: number;
    categorySlug?: string;
    featured?: boolean;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySlug(slug: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Cart operations
  getCartItems(userId: number): Promise<(CartItem & { product: Product })[]>;
  getCartItem(id: number): Promise<CartItem | undefined>;
  createCartItem(userId: number, cartItem: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: number, cartItem: Partial<CartItem>): Promise<CartItem | undefined>;
  deleteCartItem(id: number): Promise<boolean>;
  clearCart(userId: number): Promise<boolean>;

  // Order operations
  getOrders(userId?: number): Promise<Order[]>;
  getOrder(id: number): Promise<(Order & { items: (OrderItem & { product: Product })[] }) | undefined>;
  createOrder(userId: number, order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;

  // Custom order request operations
  getCustomOrderRequests(): Promise<CustomOrderRequest[]>;
  getCustomOrderRequest(id: number): Promise<CustomOrderRequest | undefined>;
  createCustomOrderRequest(userId: number | null, request: InsertCustomOrderRequest): Promise<CustomOrderRequest>;
  updateCustomOrderRequestStatus(id: number, status: string): Promise<CustomOrderRequest | undefined>;

  // Review operations
  getProductReviews(productId: number): Promise<(Review & { username: string })[]>;
  getReview(id: number): Promise<Review | undefined>;
  createReview(review: InsertReview): Promise<Review>;
  incrementHelpfulCount(id: number): Promise<Review | undefined>;

  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(insertCategory).returning();
    return category;
  }

  async updateCategory(id: number, categoryData: Partial<Category>): Promise<Category | undefined> {
    const [category] = await db.update(categories)
      .set(categoryData)
      .where(eq(categories.id, id))
      .returning();
    return category;
  }

  async deleteCategory(id: number): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id));
    return true;
  }

  // Product operations
  async getProducts(filters?: {
    categoryId?: number;
    categorySlug?: string;
    featured?: boolean;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
    fabric?: string;
    workDetails?: string;
  }): Promise<Product[]> {
    let query = db.select().from(products);

    if (filters) {
      if (filters.categoryId) {
        query = query.where(eq(products.categoryId, filters.categoryId));
      }

      if (filters.categorySlug) {
        const category = await this.getCategoryBySlug(filters.categorySlug);
        if (category) {
          query = query.where(eq(products.categoryId, category.id));
        }
      }

      if (filters.featured !== undefined) {
        query = query.where(eq(products.featured, filters.featured));
      }

      if (filters.minPrice !== undefined) {
        query = query.where(gte(products.price, filters.minPrice));
      }

      if (filters.maxPrice !== undefined) {
        query = query.where(lte(products.price, filters.maxPrice));
      }

      if (filters.search) {
        query = query.where(like(products.name, `%${filters.search}%`));
      }
      
      if (filters.fabric) {
        query = query.where(like(products.fabric, `%${filters.fabric}%`));
      }
      
      if (filters.workDetails) {
        query = query.where(like(products.workDetails, `%${filters.workDetails}%`));
      }
    }

    return query;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.slug, slug));
    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    const [product] = await db.update(products)
      .set(productData)
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: number): Promise<boolean> {
    await db.delete(products).where(eq(products.id, id));
    return true;
  }

  // Cart operations
  async getCartItems(userId: number): Promise<(CartItem & { product: Product })[]> {
    // First get the cart items for the user
    const items = await db.select().from(cartItems).where(eq(cartItems.userId, userId));
    
    // Then fetch each product for the cart items
    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = await this.getProduct(item.productId);
        return {
          ...item,
          product: product!
        };
      })
    );
    
    return itemsWithProducts;
  }

  async getCartItem(id: number): Promise<CartItem | undefined> {
    const [item] = await db.select().from(cartItems).where(eq(cartItems.id, id));
    return item;
  }

  async createCartItem(userId: number, insertCartItem: InsertCartItem): Promise<CartItem> {
    // Check if item already exists in cart
    const existingItems = await db.select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.userId, userId),
          eq(cartItems.productId, insertCartItem.productId)
        )
      );
    
    if (existingItems.length > 0) {
      // Update quantity of existing item
      const existingItem = existingItems[0];
      const newQuantity = existingItem.quantity + (insertCartItem.quantity || 1);
      
      const [updatedItem] = await db.update(cartItems)
        .set({ quantity: newQuantity })
        .where(eq(cartItems.id, existingItem.id))
        .returning();
      
      return updatedItem;
    } else {
      // Create new cart item
      const [item] = await db.insert(cartItems)
        .values({
          ...insertCartItem,
          userId
        })
        .returning();
      
      return item;
    }
  }

  async updateCartItem(id: number, cartItemData: Partial<CartItem>): Promise<CartItem | undefined> {
    const [item] = await db.update(cartItems)
      .set(cartItemData)
      .where(eq(cartItems.id, id))
      .returning();
    
    return item;
  }

  async deleteCartItem(id: number): Promise<boolean> {
    await db.delete(cartItems).where(eq(cartItems.id, id));
    return true;
  }

  async clearCart(userId: number): Promise<boolean> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
    return true;
  }

  // Order operations
  async getOrders(userId?: number): Promise<Order[]> {
    if (userId) {
      return db.select().from(orders).where(eq(orders.userId, userId));
    }
    return db.select().from(orders);
  }

  async getOrder(id: number): Promise<(Order & { items: (OrderItem & { product: Product })[] }) | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    
    if (!order) return undefined;
    
    // Get order items
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    
    // Get products for each order item
    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = await this.getProduct(item.productId);
        return {
          ...item,
          product: product!
        };
      })
    );
    
    return {
      ...order,
      items: itemsWithProducts
    };
  }

  async createOrder(userId: number, insertOrder: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    // Start a transaction
    return await db.transaction(async (tx) => {
      // Create the order
      const [order] = await tx.insert(orders)
        .values({
          ...insertOrder,
          userId
        })
        .returning();
      
      // Add order items
      if (items.length > 0) {
        await tx.insert(orderItems).values(
          items.map(item => ({
            ...item,
            orderId: order.id
          }))
        );
      }
      
      // Clear the user's cart after successful order
      await tx.delete(cartItems).where(eq(cartItems.userId, userId));
      
      return order;
    });
  }

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const [order] = await db.update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    
    return order;
  }

  // Custom order request operations
  async getCustomOrderRequests(): Promise<CustomOrderRequest[]> {
    return db.select().from(customOrderRequests);
  }

  async getCustomOrderRequest(id: number): Promise<CustomOrderRequest | undefined> {
    const [request] = await db.select().from(customOrderRequests).where(eq(customOrderRequests.id, id));
    return request;
  }

  async createCustomOrderRequest(userId: number | null, insertRequest: InsertCustomOrderRequest): Promise<CustomOrderRequest> {
    const [request] = await db.insert(customOrderRequests)
      .values({
        ...insertRequest,
        userId: userId || null,
        status: "new"
      })
      .returning();
    
    return request;
  }

  async updateCustomOrderRequestStatus(id: number, status: string): Promise<CustomOrderRequest | undefined> {
    const [request] = await db.update(customOrderRequests)
      .set({ status })
      .where(eq(customOrderRequests.id, id))
      .returning();
    
    return request;
  }

  // Review operations
  async getProductReviews(productId: number): Promise<(Review & { username: string })[]> {
    const result = await db
      .select({
        id: reviews.id,
        productId: reviews.productId,
        userId: reviews.userId,
        rating: reviews.rating,
        comment: reviews.comment,
        helpfulCount: reviews.helpfulCount,
        createdAt: reviews.createdAt,
        username: users.username,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.productId, productId))
      .orderBy(desc(reviews.createdAt));
    
    return result;
  }

  async getReview(id: number): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review;
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const [review] = await db.insert(reviews).values(insertReview).returning();
    return review;
  }

  async incrementHelpfulCount(id: number): Promise<Review | undefined> {
    const [review] = await db
      .update(reviews)
      .set({ helpfulCount: sql`${reviews.helpfulCount} + 1` })
      .where(eq(reviews.id, id))
      .returning();
    return review;
  }
}

export const storage = new DatabaseStorage();