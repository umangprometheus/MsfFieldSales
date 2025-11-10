# HubSpot Custom Object Setup for Field Visits

This document describes how to create the **Field Visits** custom object in your HubSpot account to track check-ins from the MSP Field Sales Route App.

## Why Use a Custom Object?

Currently, the app falls back to creating **Notes** for each check-in. While this works, a custom object provides:
- Structured data with specific properties
- Better reporting and analytics
- Filterable views in HubSpot
- Custom dashboards for field activity

## Creating the Field Visits Custom Object

### Step 1: Navigate to Custom Objects

1. In your HubSpot account, go to **Settings** (gear icon)
2. Navigate to **Data Management** > **Objects** > **Custom Objects**
3. Click **Create custom object**

### Step 2: Configure Object Settings

**Object Details:**
- **Object Label (singular):** Field Visit
- **Object Label (plural):** Field Visits
- **Object Name:** `field_visits` (this exact name is required)
- **Description:** Field sales check-in records from route planning app

**Primary Property:**
- **Property Label:** Visit ID
- **Property Name:** `visit_id`
- **Type:** Single-line text

### Step 3: Add Custom Properties

Add the following properties to the Field Visits custom object:

| Property Label | Property Name | Field Type | Description |
|---------------|---------------|------------|-------------|
| Company Name | `company_name` | Single-line text | Name of the visited company |
| Company ID | `company_id` | Single-line text | HubSpot company ID (for manual association) |
| Rep Username | `rep_username` | Single-line text | Sales rep's username |
| Rep User ID | `rep_user_id` | Single-line text | Sales rep's internal user ID |
| Latitude | `latitude` | Number | GPS latitude coordinate |
| Longitude | `longitude` | Number | GPS longitude coordinate |
| Notes | `notes` | Multi-line text | Rep's notes from the visit |
| Check-in Time | `check_in_time` | Date picker (with time) | Timestamp of check-in |

### Step 4: Create Association to Companies

1. In the Custom Object settings, go to **Associations**
2. Click **Add association**
3. Select **Companies** as the associated object
4. Set association label: "Field Visits" ↔ "Company"
5. Save the association

### Step 5: (Optional) Configure Automatic Association

By default, field visit records will be created **without automatic association to companies**. The company ID is stored in the `company_id` property, so you can manually associate them in HubSpot if needed.

**To enable automatic association:**

1. Get the association type ID using the HubSpot API:
   ```bash
   curl -X GET \
     'https://api.hubapi.com/crm/v4/associations/field_visits/companies/labels' \
     -H 'Authorization: Bearer YOUR_PRIVATE_APP_TOKEN'
   ```

2. Look for the `typeId` in the response (usually a number like `123`)

3. Add the association type ID to your Replit Secrets:
   - Key: `HUBSPOT_FIELD_VISIT_ASSOCIATION_TYPE_ID`
   - Value: The `typeId` from step 2 (e.g., `123`)

4. Restart your application

After this, new field visits will be automatically associated with their companies.

### Step 6: Update Required Scopes (If Needed)

Make sure your Private App has these scopes:
- ✅ `crm.objects.custom.read`
- ✅ `crm.objects.custom.write`

## Testing the Integration

Once the custom object is created:

1. Restart your application
2. Log in and create a test check-in
3. Verify in HubSpot:
   - Go to **CRM** > **Field Visits** (new menu item)
   - You should see the check-in record
   - Click it to view all properties
   - Verify it's associated with the correct Company

## Troubleshooting

**If check-ins still create Notes instead of custom object records:**

1. Check server logs for errors like:
   ```
   Custom object 'field_visits' not found, falling back to Note creation
   ```

2. Verify the object name is exactly `field_visits` (lowercase, underscore)

3. Verify the association type ID is correct in `server/services/hubspot.ts`

4. Check that your Private App token has `crm.objects.custom.write` scope

**If you see association errors:**

1. The association type ID might be wrong
2. Re-run the API call from Step 5 to get the correct `typeId`
3. Update the code and restart the app

## Current Behavior (Without Custom Object)

Until you create the custom object, the app will:
- Create HubSpot **Notes** for each check-in
- Notes will be associated with the Company
- Notes will include all the same data (GPS coordinates, timestamp, rep info, notes)

This fallback ensures the app works immediately while you set up the custom object for better long-term data management.
