import { Client } from '@hubspot/api-client';

// Get HubSpot client using Private App API key
function getHubSpotClient() {
  const apiKey = process.env.HUBSPOT_API_KEY;
  
  if (!apiKey) {
    throw new Error('HUBSPOT_API_KEY environment variable not set. Please add your Private App API key to Replit Secrets.');
  }
  
  return new Client({ accessToken: apiKey });
}

// Fetch companies from HubSpot
export async function fetchHubSpotCompanies(ownerId?: string) {
  const client = getHubSpotClient();
  
  const properties = [
    "name",
    "address",
    "address2",
    "city",
    "state",
    "zip",
    "country",
    "hubspot_owner_id",
    "hs_lastmodifieddate",
  ];

  const limit = 100;
  let after: string | undefined = undefined;
  const allCompanies: any[] = [];

  try {
    do {
      const response = await client.crm.companies.basicApi.getPage(
        limit,
        after,
        properties
      );

      const companies = response.results;
      allCompanies.push(...companies);
      after = response.paging?.next?.after;
    } while (after);

    // Filter by owner if specified
    if (ownerId) {
      return allCompanies.filter(
        (c) => c.properties.hubspot_owner_id === ownerId
      );
    }

    return allCompanies;
  } catch (error) {
    console.error("Error fetching HubSpot companies:", error);
    throw error;
  }
}

// Create a custom object record for field visit check-in
export async function createFieldVisitCheckIn(
  companyId: string,
  companyName: string,
  userId: string,
  username: string,
  lat: number,
  lng: number,
  note: string | null,
  timestamp: string
) {
  // Skip if HubSpot is not configured
  if (!process.env.HUBSPOT_API_KEY) {
    console.log("[HubSpot] Skipping field visit logging - no API key configured");
    return null;
  }
  
  const client = getHubSpotClient();

  try {
    // Create a custom object record for the field visit
    // Note: This assumes you have a custom object called "field_visits" set up in HubSpot
    // If not set up yet, this will fail - we'll handle custom object creation separately
    
    // First, try to create the field visit record without association
    // Associations can be added separately via HubSpot UI or another API call
    const customObjectResponse = await client.crm.objects.basicApi.create("field_visits", {
      properties: {
        company_name: companyName,
        company_id: companyId, // Store company ID to manually associate later if needed
        rep_username: username,
        rep_user_id: userId,
        latitude: lat.toString(),
        longitude: lng.toString(),
        notes: note || "",
        check_in_time: timestamp,
      },
    });

    console.log(`✅ Created field visit custom object ${customObjectResponse.id}`);
    
    // Optionally try to create association (non-blocking)
    // This will fail silently if association type ID is not configured
    const associationTypeId = process.env.HUBSPOT_FIELD_VISIT_ASSOCIATION_TYPE_ID;
    if (associationTypeId) {
      try {
        await client.crm.associations.batchApi.create("field_visits", "companies", {
          inputs: [
            {
              from: { id: customObjectResponse.id },
              to: { id: companyId },
              types: [
                {
                  associationCategory: "HUBSPOT_DEFINED" as any,
                  associationTypeId: parseInt(associationTypeId),
                },
              ],
            },
          ],
        });
        console.log(`✅ Associated field visit ${customObjectResponse.id} with company ${companyId}`);
      } catch (assocError) {
        console.warn("Could not create field visit → company association (non-fatal):", assocError);
      }
    }

    return customObjectResponse.id;
  } catch (error: any) {
    console.error("Error creating field visit check-in:", error);
    
    // If custom object doesn't exist, fall back to creating a Note
    if (error?.body?.category === "OBJECT_NOT_FOUND" || error?.statusCode === 404) {
      console.log("Custom object 'field_visits' not found, falling back to Note creation");
      return await createHubSpotNote(companyId, companyName, username, lat, lng, note, timestamp);
    }
    
    throw error;
  }
}

// Create a Note in HubSpot associated with a company (fallback method)
async function createHubSpotNote(
  companyId: string,
  companyName: string,
  username: string,
  lat: number,
  lng: number,
  note: string | null,
  timestamp: string
) {
  const client = getHubSpotClient();

  const noteBody = `
**Field Check-In**

- **Company:** ${companyName}
- **Time:** ${new Date(timestamp).toLocaleString()}
- **GPS:** ${lat.toFixed(6)}, ${lng.toFixed(6)}
- **Rep:** ${username}
- **Notes:** ${note || "—"}
  `.trim();

  try {
    const noteResponse = await client.crm.objects.notes.basicApi.create({
      properties: {
        hs_note_body: noteBody,
        hs_timestamp: new Date(timestamp).getTime().toString(),
      },
      associations: [
        {
          to: { id: companyId },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED" as any,
              associationTypeId: 190, // Note to Company association
            },
          ],
        },
      ],
    });

    return noteResponse.id;
  } catch (error) {
    console.error("Error creating HubSpot note:", error);
    throw error;
  }
}

// Fetch HubSpot owners (for mapping to local users)
export async function fetchHubSpotOwners() {
  const client = getHubSpotClient();

  try {
    const response = await client.crm.owners.ownersApi.getPage();
    return response.results.map((owner: any) => ({
      id: owner.id,
      email: owner.email,
      firstName: owner.firstName,
      lastName: owner.lastName,
    }));
  } catch (error) {
    console.error("Error fetching HubSpot owners:", error);
    throw error;
  }
}
