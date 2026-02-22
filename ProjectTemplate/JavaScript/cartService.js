// Cart Service - Manages shopping cart state and persistence
const CartService = {
  STORAGE_KEY: 'scrum-squad-shopping-cart',

  /**
   * Get all items in the cart
   */
  getCart() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Add item to cart
   */
  addItem(id, name, cost) {
    const cart = this.getCart();
    // Check if item already exists in cart
    const existing = cart.find(item => item.id === id);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      cart.push({ id, name, cost, quantity: 1 });
    }
    this.saveCart(cart);
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart } }));
    return cart;
  },

  /**
   * Remove item from cart
   */
  removeItem(id) {
    let cart = this.getCart();
    cart = cart.filter(item => item.id !== id);
    this.saveCart(cart);
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart } }));
    return cart;
  },

  /**
   * Update item quantity
   */
  updateQuantity(id, quantity) {
    let cart = this.getCart();
    const item = cart.find(item => item.id === id);
    if (item) {
      if (quantity <= 0) {
        cart = cart.filter(item => item.id !== id);
      } else {
        item.quantity = quantity;
      }
    }
    this.saveCart(cart);
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart } }));
    return cart;
  },

  /**
   * Clear the entire cart
   */
  clearCart() {
    localStorage.removeItem(this.STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart: [] } }));
  },

  /**
   * Get total cost of all items in cart
   */
  getTotalCost() {
    const cart = this.getCart();
    return cart.reduce((total, item) => total + (item.cost * (item.quantity || 1)), 0);
  },

  /**
   * Get item count in cart
   */
  getItemCount() {
    const cart = this.getCart();
    return cart.reduce((count, item) => count + (item.quantity || 1), 0);
  },

  /**
   * Save cart to localStorage
   */
  saveCart(cart) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart:', e);
    }
  }
};
