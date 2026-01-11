export interface Listing {
  id: string;
  title: string;
  price: number;
  shippingPrice: number;
  description: string;
  image: string;
  /** Optional gallery images for the detail view (swipeable). */
  images?: string[];
  category: string;
  size: string;
  brand: string;
  tags: string[];
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  location: string;
  createdAt: Date;
  condition: 'new' | 'like-new' | 'good' | 'fair';
}


export interface User {
  id: string;
  name: string;
  avatar: string;
  email: string;
}

export interface Message {
  id: string;
  listingId: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: Date;
}
