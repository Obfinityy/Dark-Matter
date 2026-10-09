import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPrismaModels,
  mapDrizzleTables,
  mineTypeOrmEntities,
  extractSequelizeModels,
  harvestMongooseSchemas,
  analyzeKnexMigrations,
  inferApiShapesFromModels,
} from './ormSchemaRecon.js';

test('973: extractPrismaModels parses models, fields and attributes', () => {
  const schema = `
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  @@map("users")
}

model Post {
  id     Int    @id @default(autoincrement())
  title  String
}
`;
  const models = extractPrismaModels(schema);
  assert.equal(models.length, 2);
  const user = models[0];
  assert.equal(user.name, 'User');
  assert.equal(user.table, 'users');
  const email = user.fields.find((f) => f.name === 'email');
  assert.equal(email.type, 'String');
  assert.equal(email.unique, true);
  const id = user.fields.find((f) => f.name === 'id');
  assert.equal(id.primaryKey, true);
  assert.equal(id.defaultValue, 'autoincrement()');
  const name = user.fields.find((f) => f.name === 'name');
  assert.equal(name.nullable, true);
});

test('974: mapDrizzleTables maps pgTable definitions', () => {
  const js = `
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  bio: text('bio'),
  createdAt: timestamp('created_at').defaultNow(),
});
`;
  const models = mapDrizzleTables(js);
  assert.equal(models.length, 1);
  assert.equal(models[0].table, 'users');
  const id = models[0].fields.find((f) => f.name === 'id');
  assert.equal(id.type, 'serial');
  assert.equal(id.primaryKey, true);
  const email = models[0].fields.find((f) => f.name === 'email');
  assert.equal(email.nullable, false);
  assert.equal(email.unique, true);
  const bio = models[0].fields.find((f) => f.name === 'bio');
  assert.equal(bio.nullable, true);
});

test('975: mineTypeOrmEntities parses decorated entity classes', () => {
  const js = `
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;
}
`;
  const models = mineTypeOrmEntities(js);
  assert.equal(models.length, 1);
  assert.equal(models[0].name, 'User');
  assert.equal(models[0].table, 'users');
  const id = models[0].fields.find((f) => f.name === 'id');
  assert.equal(id.primaryKey, true);
  const email = models[0].fields.find((f) => f.name === 'email');
  assert.equal(email.type, 'varchar');
  assert.equal(email.unique, true);
  const bio = models[0].fields.find((f) => f.name === 'bio');
  assert.equal(bio.nullable, true);
});

test('976: extractSequelizeModels parses define() and init()', () => {
  const js = `
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
});

class Post extends Model {}
Post.init({
  title: { type: DataTypes.STRING, allowNull: false },
}, { sequelize, tableName: 'posts', modelName: 'Post' });
`;
  const models = extractSequelizeModels(js);
  assert.equal(models.length, 2);
  const user = models.find((m) => m.name === 'User');
  assert.ok(user);
  const id = user.fields.find((f) => f.name === 'id');
  assert.equal(id.type, 'INTEGER');
  assert.equal(id.primaryKey, true);
  const email = user.fields.find((f) => f.name === 'email');
  assert.equal(email.nullable, false);
  assert.equal(email.unique, true);
  const post = models.find((m) => m.name === 'Post');
  assert.equal(post.table, 'posts');
  assert.equal(post.fields[0].name, 'title');
});

test('977: harvestMongooseSchemas parses Schema definitions', () => {
  const js = `
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  age: { type: Number, default: 18 },
  tags: [String],
}, { collection: 'users' });
const User = mongoose.model('User', userSchema);
`;
  const models = harvestMongooseSchemas(js);
  assert.equal(models.length, 1);
  assert.equal(models[0].name, 'User');
  assert.equal(models[0].table, 'users');
  const name = models[0].fields.find((f) => f.name === 'name');
  assert.equal(name.type, 'String');
  assert.equal(name.nullable, true);
  const email = models[0].fields.find((f) => f.name === 'email');
  assert.equal(email.nullable, false);
  assert.equal(email.unique, true);
  const tags = models[0].fields.find((f) => f.name === 'tags');
  assert.equal(tags.type, 'String');
});

test('978: analyzeKnexMigrations parses createTable blocks', () => {
  const js = `
exports.up = function(knex) {
  return knex.schema.createTable('users', (t) => {
    t.increments('id');
    t.string('email', 255).notNullable().unique();
    t.text('bio').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
};
`;
  const models = analyzeKnexMigrations(js);
  assert.equal(models.length, 1);
  assert.equal(models[0].table, 'users');
  assert.equal(models[0].operation, 'createTable');
  const id = models[0].fields.find((f) => f.name === 'id');
  assert.equal(id.primaryKey, true);
  const email = models[0].fields.find((f) => f.name === 'email');
  assert.equal(email.type, 'string');
  assert.equal(email.nullable, false);
  assert.equal(email.unique, true);
});

test('inferApiShapesFromModels derives CRUD endpoint shapes', () => {
  const models = extractPrismaModels('model User {\n  id Int @id\n  email String\n}');
  const endpoints = inferApiShapesFromModels(models);
  assert.equal(endpoints.length, 5);
  const methods = endpoints.map((e) => e.method);
  assert.deepEqual(methods, ['GET', 'POST', 'GET', 'PUT', 'DELETE']);
  assert.ok(endpoints.some((e) => e.path === '/user/:id'));
  assert.ok(endpoints[0].fields.includes('email'));
});

test('parsers handle empty and non-schema input gracefully', () => {
  assert.deepEqual(extractPrismaModels(''), []);
  assert.deepEqual(mapDrizzleTables('const x = 1;'), []);
  assert.deepEqual(mineTypeOrmEntities(''), []);
  assert.deepEqual(extractSequelizeModels(''), []);
  assert.deepEqual(harvestMongooseSchemas(''), []);
  assert.deepEqual(analyzeKnexMigrations(''), []);
  assert.deepEqual(inferApiShapesFromModels([]), []);
});
