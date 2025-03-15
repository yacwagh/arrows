import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { processPayment, calculateShipping, createOrder } from '../services/api';
import './Checkout.css';

const Checkout = () => {
  const { cart, cartTotal, clearCart, error: cartError } = useContext(CartContext);
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [orderSummary, setOrderSummary] = useState({
    subtotal: cartTotal,
    shipping: 0,
    tax: 0,
    total: cartTotal
  });

  // Form states
  const [shippingAddress, setShippingAddress] = useState({
    firstName: currentUser?.firstName || '',
    lastName: currentUser?.lastName || '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    phone: ''
  });
  
  const [billingAddress, setBillingAddress] = useState({
    sameAsShipping: true,
    firstName: currentUser?.firstName || '',
    lastName: currentUser?.lastName || '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    phone: ''
  });
  
  const [paymentMethod, setPaymentMethod] = useState({
    type: 'creditCard',
    cardNumber: '',
    cardName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: ''
  });
  
  const [selectedShipping, setSelectedShipping] = useState('');
  const [formErrors, setFormErrors] = useState({});
  
  // Check if cart is empty
  useEffect(() => {
    if (cart.length === 0) {
      navigate('/cart');
    }
  }, [cart, navigate]);
  
  // Calculate shipping options based on address
  useEffect(() => {
    const fetchShippingOptions = async () => {
      if (step === 2 && shippingAddress.postalCode && shippingAddress.country) {
        try {
          setLoading(true);
          const response = await calculateShipping({
            items: cart.map(item => ({
              productId: item.productId,
              quantity: item.quantity
            })),
            destination: {
              postalCode: shippingAddress.postalCode,
              countryCode: shippingAddress.country
            }
          });
          
          setShippingOptions(response.data.options);
          setLoading(false);
        } catch (err) {
          console.error('Error fetching shipping options:', err);
          setError('Failed to calculate shipping options. Please try again.');
          setLoading(false);
        }
      }
    };
    
    fetchShippingOptions();
  }, [cart, shippingAddress.postalCode, shippingAddress.country, step]);
  
  // Update order summary when shipping is selected
  useEffect(() => {
    if (selectedShipping) {
      const selectedOption = shippingOptions.find(option => option.id === selectedShipping);
      if (selectedOption) {
        // Calculate tax (example: 8% tax rate)
        const taxRate = 0.08;
        const subtotal = cartTotal;
        const shippingCost = selectedOption.cost;
        const tax = (subtotal + shippingCost) * taxRate;
        const total = subtotal + shippingCost + tax;
        
        setOrderSummary({
          subtotal,
          shipping: shippingCost,
          tax,
          total
        });
      }
    }
  }, [selectedShipping, shippingOptions, cartTotal]);
  
  // Handle shipping form changes
  const handleShippingChange = (e) => {
    const { name, value } = e.target;
    setShippingAddress({
      ...shippingAddress,
      [name]: value
    });
  };
  
  // Handle billing form changes
  const handleBillingChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'sameAsShipping') {
      setBillingAddress({
        ...billingAddress,
        sameAsShipping: checked,
        ...(checked ? shippingAddress : {})
      });
    } else {
      setBillingAddress({
        ...billingAddress,
        [name]: value
      });
    }
  };
  
  // Handle payment form changes
  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setPaymentMethod({
      ...paymentMethod,
      [name]: value
    });
  };
  
  // Validate shipping form
  const validateShippingForm = () => {
    const errors = {};
    
    if (!shippingAddress.firstName.trim()) errors.shippingFirstName = 'First name is required';
    if (!shippingAddress.lastName.trim()) errors.shippingLastName = 'Last name is required';
    if (!shippingAddress.address1.trim()) errors.shippingAddress1 = 'Address is required';
    if (!shippingAddress.city.trim()) errors.shippingCity = 'City is required';
    if (!shippingAddress.state.trim()) errors.shippingState = 'State is required';
    if (!shippingAddress.postalCode.trim()) errors.shippingPostalCode = 'Postal code is required';
    if (!shippingAddress.phone.trim()) errors.shippingPhone = 'Phone number is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Validate billing form
  const validateBillingForm = () => {
    if (billingAddress.sameAsShipping) return true;
    
    const errors = {...formErrors};
    
    if (!billingAddress.firstName.trim()) errors.billingFirstName = 'First name is required';
    if (!billingAddress.lastName.trim()) errors.billingLastName = 'Last name is required';
    if (!billingAddress.address1.trim()) errors.billingAddress1 = 'Address is required';
    if (!billingAddress.city.trim()) errors.billingCity = 'City is required';
    if (!billingAddress.state.trim()) errors.billingState = 'State is required';
    if (!billingAddress.postalCode.trim()) errors.billingPostalCode = 'Postal code is required';
    if (!billingAddress.phone.trim()) errors.billingPhone = 'Phone number is required';
    
    setFormErrors(errors);
    return Object.keys(errors).filter(key => key.startsWith('billing')).length === 0;
  };
  
  // Validate shipping method
  const validateShippingMethod = () => {
    const errors = {...formErrors};
    
    if (!selectedShipping) errors.shippingMethod = 'Please select a shipping method';
    
    setFormErrors(errors);
    return !errors.shippingMethod;
  };
  
  // Validate payment form
  const validatePaymentForm = () => {
    const errors = {...formErrors};
    
    if (paymentMethod.type === 'creditCard') {
      if (!paymentMethod.cardNumber.trim()) errors.cardNumber = 'Card number is required';
      if (!paymentMethod.cardName.trim()) errors.cardName = 'Name on card is required';
      if (!paymentMethod.expiryMonth) errors.expiryMonth = 'Expiry month is required';
      if (!paymentMethod.expiryYear) errors.expiryYear = 'Expiry year is required';
      if (!paymentMethod.cvv.trim()) errors.cvv = 'CVV is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).filter(key => 
      ['cardNumber', 'cardName', 'expiryMonth', 'expiryYear', 'cvv'].includes(key)
    ).length === 0;
  };
  
  // Handle next step
  const handleNextStep = () => {
    let isValid = false;
    
    switch (step) {
      case 1: // Shipping address
        isValid = validateShippingForm();
        break;
      case 2: // Shipping method
        isValid = validateShippingMethod();
        break;
      case 3: // Payment
        isValid = validatePaymentForm() && validateBillingForm();
        break;
      default:
        isValid = false;
    }
    
    if (isValid) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    }
  };
  
  // Handle back step
  const handlePreviousStep = () => {
    setStep(step - 1);
    window.scrollTo(0, 0);
  };
  
  // Handle order submission
  const handlePlaceOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Process payment
      const paymentResponse = await processPayment({
        amount: orderSummary.total,
        currency: 'USD',
        paymentMethod: {
          type: paymentMethod.type,
          cardNumber: paymentMethod.cardNumber,
          cardName: paymentMethod.cardName,
          expiryMonth: paymentMethod.expiryMonth,
          expiryYear: paymentMethod.expiryYear,
          cvv: paymentMethod.cvv
        }
      });
      
      if (paymentResponse.status === 200) {
        // Create order
        const orderResponse = await createOrder({
          items: cart.map(item => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity
          })),
          shipping: {
            method: selectedShipping,
            cost: orderSummary.shipping,
            address: shippingAddress
          },
          billing: billingAddress.sameAsShipping ? shippingAddress : billingAddress,
          payment: {
            transactionId: paymentResponse.data.transactionId,
            amount: orderSummary.total,
            method: paymentMethod.type
          },
          totals: orderSummary
        });
        
        if (orderResponse.status === 201) {
          // Clear cart and redirect to success page
          await clearCart();
          navigate(`/order-confirmation/${orderResponse.data.id}`);
        }
      }
    } catch (err) {
      console.error('Error processing order:', err);
      setError(err.response?.data?.message || 'Failed to process your order. Please try again.');
      setLoading(false);
    }
  };
  
  // Render shipping address form
  const renderShippingForm = () => (
    <div className="checkout-form">
      <h3>Shipping Address</h3>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="firstName">First Name</label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={shippingAddress.firstName}
            onChange={handleShippingChange}
            className={formErrors.shippingFirstName ? 'error' : ''}
          />
          {formErrors.shippingFirstName && <div className="error-text">{formErrors.shippingFirstName}</div>}
        </div>
        
        <div className="form-group">
          <label htmlFor="lastName">Last Name</label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={shippingAddress.lastName}
            onChange={handleShippingChange}
            className={formErrors.shippingLastName ? 'error' : ''}
          />
          {formErrors.shippingLastName && <div className="error-text">{formErrors.shippingLastName}</div>}
        </div>
      </div>
      
      <div className="form-group">
        <label htmlFor="address1">Address</label>
        <input
          type="text"
          id="address1"
          name="address1"
          value={shippingAddress.address1}
          onChange={handleShippingChange}
          className={formErrors.shippingAddress1 ? 'error' : ''}
          placeholder="Street address"
        />
        {formErrors.shippingAddress1 && <div className="error-text">{formErrors.shippingAddress1}</div>}
      </div>
      
      <div className="form-group">
        <label htmlFor="address2">Address Line 2 (Optional)</label>
        <input
          type="text"
          id="address2"
          name="address2"
          value={shippingAddress.address2}
          onChange={handleShippingChange}
          placeholder="Apartment, suite, unit, building, floor, etc."
        />
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="city">City</label>
          <input
            type="text"
            id="city"
            name="city"
            value={shippingAddress.city}
            onChange={handleShippingChange}
            className={formErrors.shippingCity ? 'error' : ''}
          />
          {formErrors.shippingCity && <div className="error-text">{formErrors.shippingCity}</div>}
        </div>
        
        <div className="form-group">
          <label htmlFor="state">State/Province</label>
          <input
            type="text"
            id="state"
            name="state"
            value={shippingAddress.state}
            onChange={handleShippingChange}
            className={formErrors.shippingState ? 'error' : ''}
          />
          {formErrors.shippingState && <div className="error-text">{formErrors.shippingState}</div>}
        </div>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="postalCode">Postal Code</label>
          <input
            type="text"
            id="postalCode"
            name="postalCode"
            value={shippingAddress.postalCode}
            onChange={handleShippingChange}
            className={formErrors.shippingPostalCode ? 'error' : ''}
          />
          {formErrors.shippingPostalCode && <div className="error-text">{formErrors.shippingPostalCode}</div>}
        </div>
        
        <div className="form-group">
          <label htmlFor="country">Country</label>
          <select
            id="country"
            name="country"
            value={shippingAddress.country}
            onChange={handleShippingChange}
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
          </select>
        </div>
      </div>
      
      <div className="form-group">
        <label htmlFor="phone">Phone Number</label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={shippingAddress.phone}
          onChange={handleShippingChange}
          className={formErrors.shippingPhone ? 'error' : ''}
          placeholder="For delivery questions only"
        />
        {formErrors.shippingPhone && <div className="error-text">{formErrors.shippingPhone}</div>}
      </div>
      
      <div className="form-actions">
        <button type="button" onClick={() => navigate('/cart')} className="secondary-button">
          Back to Cart
        </button>
        <button type="button" onClick={handleNextStep} className="primary-button">
          Continue to Shipping Method
        </button>
      </div>
    </div>
  );
  
  // Render shipping method options
  const renderShippingMethod = () => (
    <div className="checkout-form">
      <h3>Shipping Method</h3>
      
      {loading ? (
        <div className="loading">Loading shipping options...</div>
      ) : (
        <>
          {shippingOptions.length > 0 ? (
            <div className="shipping-options">
              {shippingOptions.map(option => (
                <div key={option.id} className="shipping-option">
                  <label>
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={option.id}
                      checked={selectedShipping === option.id}
                      onChange={() => setSelectedShipping(option.id)}
                    />
                    <div className="shipping-option-details">
                      <span className="shipping-name">{option.name}</span>
                      <span className="shipping-estimate">
                        Estimated delivery: {option.estimatedDelivery}
                      </span>
                      <span className="shipping-price">${option.cost.toFixed(2)}</span>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-options">
              No shipping options available for this address. Please update your address or contact customer support.
            </div>
          )}
          
          {formErrors.shippingMethod && (
            <div className="error-text">{formErrors.shippingMethod}</div>
          )}
          
          <div className="form-actions">
            <button type="button" onClick={handlePreviousStep} className="secondary-button">
              Back to Shipping Address
            </button>
            <button 
              type="button" 
              onClick={handleNextStep} 
              className="primary-button"
              disabled={shippingOptions.length === 0}
            >
              Continue to Payment
            </button>
          </div>
        </>
      )}
    </div>
  );
  
  // Render payment form
  const renderPaymentForm = () => (
    <div className="checkout-form">
      <h3>Payment Information</h3>
      
      <div className="payment-methods">
        <div className="payment-method">
          <label>
            <input
              type="radio"
              name="type"
              value="creditCard"
              checked={paymentMethod.type === 'creditCard'}
              onChange={handlePaymentChange}
            />
            Credit Card
          </label>
        </div>
        
        <div className="payment-method">
          <label>
            <input
              type="radio"
              name="type"
              value="paypal"
              checked={paymentMethod.type === 'paypal'}
              onChange={handlePaymentChange}
            />
            PayPal
          </label>
        </div>
      </div>
      
      {paymentMethod.type === 'creditCard' && (
        <div className="credit-card-form">
          <div className="form-group">
            <label htmlFor="cardNumber">Card Number</label>
            <input
              type="text"
              id="cardNumber"
              name="cardNumber"
              value={paymentMethod.cardNumber}
              onChange={handlePaymentChange}
              className={formErrors.cardNumber ? 'error' : ''}
              placeholder="1234 5678 9012 3456"
            />
            {formErrors.cardNumber && <div className="error-text">{formErrors.cardNumber}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="cardName">Name on Card</label>
            <input
              type="text"
              id="cardName"
              name="cardName"
              value={paymentMethod.cardName}
              onChange={handlePaymentChange}
              className={formErrors.cardName ? 'error' : ''}
              placeholder="John Doe"
            />
            {formErrors.cardName && <div className="error-text">{formErrors.cardName}</div>}
          </div>
          
          <div className="form-row">
            <div className="form-group expiry">
              <label>Expiration Date</label>
              <div className="expiry-inputs">
                <select
                  name="expiryMonth"
                  value={paymentMethod.expiryMonth}
                  onChange={handlePaymentChange}
                  className={formErrors.expiryMonth ? 'error' : ''}
                >
                  <option value="">Month</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month.toString().padStart(2, '0')}>
                      {month.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
                
                <select
                  name="expiryYear"
                  value={paymentMethod.expiryYear}
                  onChange={handlePaymentChange}
                  className={formErrors.expiryYear ? 'error' : ''}
                >
                  <option value="">Year</option>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              {(formErrors.expiryMonth || formErrors.expiryYear) && (
                <div className="error-text">Please select a valid expiration date</div>
              )}
            </div>
            
            <div className="form-group cvv">
              <label htmlFor="cvv">CVV</label>
              <input
                type="text"
                id="cvv"
                name="cvv"
                value={paymentMethod.cvv}
                onChange={handlePaymentChange}
                className={formErrors.cvv ? 'error' : ''}
                placeholder="123"
                maxLength="4"
              />
              {formErrors.cvv && <div className="error-text">{formErrors.cvv}</div>}
            </div>
          </div>
        </div>
      )}
      
      <div className="billing-address">
        <h4>Billing Address</h4>
        
        <div className="form-group same-address">
          <label>
            <input
              type="checkbox"
              name="sameAsShipping"
              checked={billingAddress.sameAsShipping}
              onChange={handleBillingChange}
            />
            Same as shipping address
          </label>
        </div>
        
        {!billingAddress.sameAsShipping && (
          <div className="billing-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="billingFirstName">First Name</label>
                <input
                  type="text"
                  id="billingFirstName"
                  name="firstName"
                  value={billingAddress.firstName}
                  onChange={handleBillingChange}
                  className={formErrors.billingFirstName ? 'error' : ''}
                />
                {formErrors.billingFirstName && <div className="error-text">{formErrors.billingFirstName}</div>}
              </div>
              
              <div className="form-group">
                <label htmlFor="billingLastName">Last Name</label>
                <input
                  type="text"
                  id="billingLastName"
                  name="lastName"
                  value={billingAddress.lastName}
                  onChange={handleBillingChange}
                  className={formErrors.billingLastName ? 'error' : ''}
                />
                {formErrors.billingLastName && <div className="error-text">{formErrors.billingLastName}</div>}
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="billingAddress1">Address</label>
              <input
                type="text"
                id="billingAddress1"
                name="address1"
                value={billingAddress.address1}
                onChange={handleBillingChange}
                className={formErrors.billingAddress1 ? 'error' : ''}
              />
              {formErrors.billingAddress1 && <div className="error-text">{formErrors.billingAddress1}</div>}
            </div>
            
            <div className="form-group">
              <label htmlFor="billingAddress2">Address Line 2 (Optional)</label>
              <input
                type="text"
                id="billingAddress2"
                name="address2"
                value={billingAddress.address2}
                onChange={handleBillingChange}
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="billingCity">City</label>
                <input
                  type="text"
                  id="billingCity"
                  name="city"
                  value={billingAddress.city}
                  onChange={handleBillingChange}
                  className={formErrors.billingCity ? 'error' : ''}
                />
                {formErrors.billingCity && <div className="error-text">{formErrors.billingCity}</div>}
              </div>
              
              <div className="form-group">
                <label htmlFor="billingState">State/Province</label>
                <input
                  type="text"
                  id="billingState"
                  name="state"
                  value={billingAddress.state}
                  onChange={handleBillingChange}
                  className={formErrors.billingState ? 'error' : ''}
                />
                {formErrors.billingState && <div className="error-text">{formErrors.billingState}</div>}
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="billingPostalCode">Postal Code</label>
                <input
                  type="text"
                  id="billingPostalCode"
                  name="postalCode"
                  value={billingAddress.postalCode}
                  onChange={handleBillingChange}
                  className={formErrors.billingPostalCode ? 'error' : ''}
                />
                {formErrors.billingPostalCode && <div className="error-text">{formErrors.billingPostalCode}</div>}
              </div>
              
              <div className="form-group">
                <label htmlFor="billingCountry">Country</label>
                <select
                  id="billingCountry"
                  name="country"
                  value={billingAddress.country}
                  onChange={handleBillingChange}
                >
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="billingPhone">Phone Number</label>
              <input
                type="tel"
                id="billingPhone"
                name="phone"
                value={billingAddress.phone}
                onChange={handleBillingChange}
                className={formErrors.billingPhone ? 'error' : ''}
              />
              {formErrors.billingPhone && <div className="error-text">{formErrors.billingPhone}</div>}
            </div>
          </div>
        )}
      </div>
      
      <div className="form-actions">
        <button type="button" onClick={handlePreviousStep} className="secondary-button">
          Back to Shipping Method
        </button>
        <button type="button" onClick={handleNextStep} className="primary-button">
          Review Order
        </button>
      </div>
    </div>
  );
  
  // Render order review
  const renderOrderReview = () => (
    <div className="checkout-form">
      <h3>Review Your Order</h3>
      
      <div className="review-section">
        <div className="review-header">
          <h4>Items in Order</h4>
          <button type="button" onClick={() => navigate('/cart')} className="edit-button">
            Edit
          </button>
        </div>
        
        <div className="order-items">
          {cart.map(item => (
            <div key={item.productId} className="order-item">
              <div className="item-image">
                <img src={item.image} alt={item.name} />
              </div>
              <div className="item-details">
                <h5>{item.name}</h5>
                <p>Quantity: {item.quantity}</p>
                <p className="item-price">${(item.price * item.quantity).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="review-section">
        <div className="review-header">
          <h4>Shipping Information</h4>
          <button type="button" onClick={() => setStep(1)} className="edit-button">
            Edit
          </button>
        </div>
        
        <div className="shipping-info">
          <p>
            {shippingAddress.firstName} {shippingAddress.lastName}
          </p>
          <p>{shippingAddress.address1}</p>
          {shippingAddress.address2 && <p>{shippingAddress.address2}</p>}
          <p>
            {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
          </p>
          <p>{shippingAddress.country}</p>
          <p>{shippingAddress.phone}</p>
        </div>
      </div>
      
      <div className="review-section">
        <div className="review-header">
          <h4>Shipping Method</h4>
          <button type="button" onClick={() => setStep(2)} className="edit-button">
            Edit
          </button>
        </div>
        
        <div className="shipping-method-info">
          {selectedShipping && (
            <p>
              {shippingOptions.find(option => option.id === selectedShipping)?.name} - 
              ${shippingOptions.find(option => option.id === selectedShipping)?.cost.toFixed(2)}
            </p>
          )}
        </div>
      </div>
      
      <div className="review-section">
        <div className="review-header">
          <h4>Payment Information</h4>
          <button type="button" onClick={() => setStep(3)} className="edit-button">
            Edit
          </button>
        </div>
        
        <div className="payment-info">
          {paymentMethod.type === 'creditCard' ? (
            <>
              <p>Credit Card</p>
              <p>**** **** **** {paymentMethod.cardNumber.slice(-4)}</p>
              <p>{paymentMethod.cardName}</p>
              <p>
                Exp: {paymentMethod.expiryMonth}/{paymentMethod.expiryYear}
              </p>
            </>
          ) : (
            <p>PayPal</p>
          )}
        </div>
      </div>
      
      <div className="review-section">
        <div className="review-header">
          <h4>Billing Address</h4>
          <button type="button" onClick={() => setStep(3)} className="edit-button">
            Edit
          </button>
        </div>
        
        <div className="billing-info">
          {billingAddress.sameAsShipping ? (
            <p>Same as shipping address</p>
          ) : (
            <>
              <p>
                {billingAddress.firstName} {billingAddress.lastName}
              </p>
              <p>{billingAddress.address1}</p>
              {billingAddress.address2 && <p>{billingAddress.address2}</p>}
              <p>
                {billingAddress.city}, {billingAddress.state} {billingAddress.postalCode}
              </p>
              <p>{billingAddress.country}</p>
              <p>{billingAddress.phone}</p>
            </>
          )}
        </div>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="form-actions">
        <button type="button" onClick={handlePreviousStep} className="secondary-button">
          Back to Payment
        </button>
        <button 
          type="button" 
          onClick={handlePlaceOrder} 
          className="primary-button"
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Place Order'}
        </button>
      </div>
    </div>
  );
  
  return (
    <div className="checkout-container">
      <div className="checkout-steps">
        <div className={`step ${step >= 1 ? 'active' : ''}`}>
          <div className="step-number">1</div>
          <div className="step-title">Shipping</div>
        </div