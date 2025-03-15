import React, { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import api from '../services/api';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isAuthenticated, currentUser } = useContext(AuthContext);

  // Load cart from localStorage or from API if user is logged in
  useEffect(() => {
    const fetchCart = async () => {
      if (isAuthenticated && currentUser) {
        try {
          setLoading(true);
          const response = await api.get('/cart');
          if (response.status === 200) {
            setCart(response.data);
          }
        } catch (err) {
          console.error('Error fetching cart:', err);
          setError('Failed to load your cart. Please try again.');
        } finally {
          setLoading(false);
        }
      } else {
        // Load from localStorage for guest users
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
          try {
            setCart(JSON.parse(savedCart));
          } catch (err) {
            console.error('Error parsing cart from localStorage:', err);
            localStorage.removeItem('cart');
          }
        }
      }
    };

    fetchCart();
  }, [isAuthenticated, currentUser]);

  // Save cart to localStorage for guest users
  useEffect(() => {
    if (!isAuthenticated) {
      localStorage.setItem('cart', JSON.stringify(cart));
    }
  }, [cart, isAuthenticated]);

  const addToCart = async (product, quantity = 1) => {
    setError(null);
    
    try {
      const existingItem = cart.find(item => item.productId === product.id);
      
      if (existingItem) {
        // Update quantity if item already exists
        const updatedCart = cart.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
        
        if (isAuthenticated) {
          await api.put(`/cart/items/${product.id}`, { 
            quantity: existingItem.quantity + quantity 
          });
        }
        
        setCart(updatedCart);
      } else {
        // Add new item
        const newItem = {
          productId: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity
        };
        
        if (isAuthenticated) {
          await api.post('/cart/items', { 
            productId: product.id, 
            quantity 
          });
        }
        
        setCart([...cart, newItem]);
      }
      
      return true;
    } catch (err) {
      console.error('Error adding to cart:', err);
      setError('Failed to add item to cart. Please try again.');
      return false;
    }
  };

  const updateCartItem = async (productId, quantity) => {
    setError(null);
    
    try {
      if (quantity <= 0) {
        return removeFromCart(productId);
      }
      
      const updatedCart = cart.map(item => 
        item.productId === productId ? { ...item, quantity } : item
      );
      
      if (isAuthenticated) {
        await api.put(`/cart/items/${productId}`, { quantity });
      }
      
      setCart(updatedCart);
      return true;
    } catch (err) {
      console.error('Error updating cart item:', err);
      setError('Failed to update cart. Please try again.');
      return false;
    }
  };

  const removeFromCart = async (productId) => {
    setError(null);
    
    try {
      const updatedCart = cart.filter(item => item.productId !== productId);
      
      if (isAuthenticated) {
        await api.delete(`/cart/items/${productId}`);
      }
      
      setCart(updatedCart);
      return true;
    } catch (err) {
      console.error('Error removing from cart:', err);
      setError('Failed to remove item from cart. Please try again.');
      return false;
    }
  };

  const clearCart = async () => {
    setError(null);
    
    try {
      if (isAuthenticated) {
        await api.delete('/cart');
      }
      
      setCart([]);
      return true;
    } catch (err) {
      console.error('Error clearing cart:', err);
      setError('Failed to clear cart. Please try again.');
      return false;
    }
  };

  // Calculate cart totals
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const itemCount = cart.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        error,
        cartTotal,
        itemCount,
        addToCart,
        updateCartItem,
        removeFromCart,
        clearCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
};