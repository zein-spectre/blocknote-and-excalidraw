import { Client, Databases, Storage, ID } from 'appwrite';

const client = new Client()
    .setEndpoint('https://appwrite.geladisalam.my.id/v1')
    .setProject('blocknote-x-excalidraw');

export const databases = new Databases(client);
export const storage = new Storage(client);

export const APPWRITE_CONFIG = {
    databaseId: 'blocknote_db',
    collectionId: 'articles',
    bucketId: 'editor_images'
};

export { ID };
