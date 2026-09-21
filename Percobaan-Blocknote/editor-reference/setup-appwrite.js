import { Client, Databases, Storage, Permission, Role } from "node-appwrite";

const client = new Client()
    .setEndpoint('https://appwrite.geladisalam.my.id/v1') // Appwrite Endpoint
    .setProject('blocknote-x-excalidraw') // Project ID
    .setKey('5bfef8dec05dee44e4445dc12bb4f6c217d7a17391e5c88b1034701c33091e524421746d2eab3a0c655d1faaba327a75e08fce8a79e8665f1513c185c06109d95929cff32ada59927c1b11381563a26ec064d84498af3cada2f7a1e041aebd796e069ced42c56acb78cf18379fd54ae9b2791656988f2aaf55f4bd40032435f6');

const databases = new Databases(client);
const storage = new Storage(client);

const DB_ID = 'blocknote_db';
const COLLECTION_ID = 'articles';
const BUCKET_ID = 'editor_images';

async function setup() {
    try {
        console.log('Creating database...');
        try {
            await databases.create(DB_ID, 'BlockNote Database');
            console.log('Database created.');
        } catch (e) {
            console.log('Database might already exist: ', e.message);
        }

        console.log('Creating collection...');
        try {
            await databases.createCollection(
                DB_ID,
                COLLECTION_ID,
                'Articles',
                [Permission.read(Role.any()), Permission.write(Role.any()), Permission.update(Role.any()), Permission.delete(Role.any())]
            );
            console.log('Collection created.');
        } catch (e) {
            console.log('Collection might already exist: ', e.message);
        }

        console.log('Creating attributes...');
        try {
            await databases.createStringAttribute(DB_ID, COLLECTION_ID, 'title', 255, true);
            await databases.createStringAttribute(DB_ID, COLLECTION_ID, 'content', 10000000, true);
            await databases.createStringAttribute(DB_ID, COLLECTION_ID, 'status', 20, false, 'draft');
            console.log('Attributes created.');
        } catch (e) {
            console.log('Attributes might already exist: ', e.message);
        }

        console.log('Creating storage bucket...');
        try {
            await storage.createBucket(
                BUCKET_ID,
                'Editor Images',
                [Permission.read(Role.any()), Permission.write(Role.any()), Permission.update(Role.any()), Permission.delete(Role.any())],
                false, // fileSecurity
                undefined, // max file size
                undefined // allowed extensions
            );
            console.log('Bucket created.');
        } catch (e) {
            console.log('Bucket might already exist: ', e.message);
        }

        console.log('Appwrite Setup Complete!');
    } catch (error) {
        console.error('Error during setup:', error);
    }
}

setup();
