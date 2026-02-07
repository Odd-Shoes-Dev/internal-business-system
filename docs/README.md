# BlueOx Platform Documentation

This directory contains comprehensive documentation for the BlueOx Business Management Platform.

## 📂 Documentation Structure

- **[api/](./api/)** - Complete API documentation and integration guides
- **[contracts/](./contracts/)** - Legal documents, pricing guides, and terms
- **[platform-transformation/](./platform-transformation/)** - Platform transformation guides

## 🚀 Quick Access

### For API Developers
📖 **Start here**: [api/API_INTEGRATION_GUIDE.md](./api/API_INTEGRATION_GUIDE.md)

### For Business Users  
📖 **User Guide**: [USER_GUIDE.md](./USER_GUIDE.md)

### For System Administrators
📖 **Architecture Guide**: [SAAS_ARCHITECTURE_GUIDE.md](./SAAS_ARCHITECTURE_GUIDE.md)

1. **Read the Integration Guide**: Start with [`api/API_INTEGRATION_GUIDE.md`](./api/API_INTEGRATION_GUIDE.md)
2. **Get API credentials** from your BlueOx administrator
3. **Choose your integration method** (webhooks recommended)
4. **Test in staging environment** before going live

### For API Documentation Tools

Use the [`api/openapi.json`](./api/openapi.json) file with documentation tools:

#### Swagger UI
```bash
# Serve with npx
npx swagger-ui-serve api/openapi.json

# Or visit: https://editor.swagger.io/
# Copy/paste the contents of api/openapi.json
```

#### Postman
```bash
# In Postman, go to:
# File > Import > Upload Files > Select api/openapi.json
```

#### Insomnia
```bash
# Create new workspace
# Import from file > Select api/openapi.json
```

## 🔗 Live Documentation

- **Interactive API Explorer**: [https://docs.api.blueox.app](https://docs.api.blueox.app)
- **Developer Portal**: [https://developers.blueox.app](https://developers.blueox.app)
- **Community Forum**: [https://community.blueox.app](https://community.blueox.app)

## 📝 Integration Examples

### Salon POS System
```javascript
// Quick example - see full guide for details
const blueox = new BlueOxIntegration('your_api_key', 'your_system_id');

await blueox.syncSale({
  sale_id: 'SALE_001',
  customer_name: 'John Doe',
  amount: 50000,
  payment_method: 'cash',
  currency: 'UGX',
  services: [...]
});
```

### Dashboard Widget
```javascript
// Get financial summary for dashboard
const summary = await blueox.getFinancialSummary('2026-02-01', '2026-02-29');
console.log('Revenue:', summary.revenue.total_revenue);
```

## 🛠️ Development Workflow

1. **Sandbox Testing**
   - Use staging environment: `https://api-staging.blueox.app`
   - Test all integration flows
   - Validate error handling

2. **Production Deployment**
   - Switch to production base URL: `https://api.blueox.app`
   - Monitor integration logs
   - Set up alerts for failures

3. **Monitoring**
   - Check rate limit headers
   - Log all API responses
   - Implement retry logic

## 📊 API Status

- **System Status**: [https://status.blueox.app](https://status.blueox.app)
- **API Health**: `GET /api/health`
- **Version Info**: `GET /api/version`

## 🤝 Support

- **Technical Issues**: [api-support@blueox.app](mailto:api-support@blueox.app)
- **Sales & Partnerships**: [partnerships@blueox.app](mailto:partnerships@blueox.app)
- **General Support**: [support@blueox.app](mailto:support@blueox.app)

## 📋 Integration Checklist

- [ ] Read complete integration guide
- [ ] Obtain API credentials
- [ ] Test webhook endpoint in staging
- [ ] Implement error handling  
- [ ] Test rate limiting scenarios
- [ ] Validate accounting entries in BlueOx
- [ ] Document your integration
- [ ] Deploy to production
- [ ] Monitor and maintain

---

**© 2026 BlueOx Business Platform. All rights reserved.**