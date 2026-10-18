const request = require("supertest");
const app = require("../api/index");

const API_PREFIX = "/hometask_04/api";
const ADMIN_AUTH = `Basic ${Buffer.from("admin:qwerty").toString("base64")}`;

describe("hometask_04 api", () => {
  beforeEach(async () => {
    await request(app).delete(`${API_PREFIX}/testing/all-data`).expect(204);
  });

  it("GET /blogs returns paginated response with defaults", async () => {
    const response = await request(app).get(`${API_PREFIX}/blogs`).expect(200);

    expect(response.body).toEqual({
      pagesCount: 0,
      page: 1,
      pageSize: 10,
      totalCount: 0,
      items: [],
    });
  });

  it("GET /blogs filters by searchNameTerm (case-insensitive)", async () => {
    const blogsToCreate = [
      { name: "Ivan", description: "desc", websiteUrl: "https://ivan.com" },
      { name: "DiVan", description: "desc", websiteUrl: "https://divan.com" },
      { name: "JanClod Vandam", description: "desc", websiteUrl: "https://vandam.com" },
      { name: "Petya", description: "desc", websiteUrl: "https://petya.com" },
    ];

    for (const blog of blogsToCreate) {
      await request(app).post(`${API_PREFIX}/blogs`).set("authorization", ADMIN_AUTH).send(blog).expect(201);
    }

    const response = await request(app)
      .get(`${API_PREFIX}/blogs`)
      .query({ searchNameTerm: "va", sortBy: "name", sortDirection: "asc", pageNumber: 1, pageSize: 10 })
      .expect(200);

    expect(response.body.totalCount).toBe(3);
    expect(response.body.items.map((x) => x.name)).toEqual(["DiVan", "Ivan", "JanClod Vandam"]);
  });

  it("GET /posts returns paginated and sorted items", async () => {
    const blogResponse = await request(app)
      .post(`${API_PREFIX}/blogs`)
      .set("authorization", ADMIN_AUTH)
      .send({ name: "Blog", description: "desc", websiteUrl: "https://blog.com" })
      .expect(201);

    const blogId = blogResponse.body.id;
    await request(app)
      .post(`${API_PREFIX}/posts`)
      .set("authorization", ADMIN_AUTH)
      .send({ title: "B", shortDescription: "short", content: "content", blogId })
      .expect(201);
    await request(app)
      .post(`${API_PREFIX}/posts`)
      .set("authorization", ADMIN_AUTH)
      .send({ title: "A", shortDescription: "short", content: "content", blogId })
      .expect(201);

    const response = await request(app)
      .get(`${API_PREFIX}/posts`)
      .query({ sortBy: "title", sortDirection: "asc", pageNumber: 1, pageSize: 1 })
      .expect(200);

    expect(response.body.totalCount).toBe(2);
    expect(response.body.pagesCount).toBe(2);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].title).toBe("A");
  });

  it("POST /blogs/:id/posts creates post for specific blog", async () => {
    const blogResponse = await request(app)
      .post(`${API_PREFIX}/blogs`)
      .set("authorization", ADMIN_AUTH)
      .send({ name: "Blog A", description: "desc", websiteUrl: "https://bloga.com" })
      .expect(201);

    const postResponse = await request(app)
      .post(`${API_PREFIX}/blogs/${blogResponse.body.id}/posts`)
      .set("authorization", ADMIN_AUTH)
      .send({ title: "T", shortDescription: "S", content: "C" })
      .expect(201);

    expect(postResponse.body.blogId).toBe(blogResponse.body.id);
    expect(postResponse.body.blogName).toBe("Blog A");
  });

  it("GET /blogs/:id/posts returns 404 for non-existing blog", async () => {
    await request(app).get(`${API_PREFIX}/blogs/999/posts`).expect(404);
  });

  it("GET /blogs/:id/posts returns paginated blog posts", async () => {
    const blogResponse = await request(app)
      .post(`${API_PREFIX}/blogs`)
      .set("authorization", ADMIN_AUTH)
      .send({ name: "Blog A", description: "desc", websiteUrl: "https://bloga.com" })
      .expect(201);

    const blogId = blogResponse.body.id;
    await request(app)
      .post(`${API_PREFIX}/blogs/${blogId}/posts`)
      .set("authorization", ADMIN_AUTH)
      .send({ title: "B-title", shortDescription: "S1", content: "C1" })
      .expect(201);
    await request(app)
      .post(`${API_PREFIX}/blogs/${blogId}/posts`)
      .set("authorization", ADMIN_AUTH)
      .send({ title: "A-title", shortDescription: "S2", content: "C2" })
      .expect(201);

    const response = await request(app)
      .get(`${API_PREFIX}/blogs/${blogId}/posts`)
      .query({ sortBy: "title", sortDirection: "asc", pageNumber: 1, pageSize: 10 })
      .expect(200);

    expect(response.body.totalCount).toBe(2);
    expect(response.body.items.map((x) => x.title)).toEqual(["A-title", "B-title"]);
  });

  it("POST /blogs returns 401 without basic auth", async () => {
    await request(app)
      .post(`${API_PREFIX}/blogs`)
      .send({ name: "Blog", description: "desc", websiteUrl: "https://blog.com" })
      .expect(401);
  });

  it("POST /blogs returns 400 with invalid body", async () => {
    const response = await request(app)
      .post(`${API_PREFIX}/blogs`)
      .set("authorization", ADMIN_AUTH)
      .send({ name: "", description: "", websiteUrl: "http://not-secure.com" })
      .expect(400);

    expect(response.body.errorsMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "name" }),
        expect.objectContaining({ field: "description" }),
        expect.objectContaining({ field: "websiteUrl" }),
      ])
    );
  });

  it("GET /blogs/:id returns 404 for non-existing blog", async () => {
    await request(app).get(`${API_PREFIX}/blogs/123456`).expect(404);
  });

  it("PUT /blogs/:id returns 404 for non-existing blog", async () => {
    await request(app)
      .put(`${API_PREFIX}/blogs/123456`)
      .set("authorization", ADMIN_AUTH)
      .send({ name: "Blog", description: "desc", websiteUrl: "https://blog.com" })
      .expect(404);
  });

  it("POST /posts returns 400 for non-existing blogId", async () => {
    const response = await request(app)
      .post(`${API_PREFIX}/posts`)
      .set("authorization", ADMIN_AUTH)
      .send({ title: "T", shortDescription: "S", content: "C", blogId: "777" })
      .expect(400);

    expect(response.body.errorsMessages).toEqual(expect.arrayContaining([expect.objectContaining({ field: "blogId" })]));
  });

  it("POST /posts returns 401 without basic auth", async () => {
    await request(app)
      .post(`${API_PREFIX}/posts`)
      .send({ title: "T", shortDescription: "S", content: "C", blogId: "1" })
      .expect(401);
  });

  it("GET /posts/:id returns 404 for non-existing post", async () => {
    await request(app).get(`${API_PREFIX}/posts/123456`).expect(404);
  });

  it("PUT /posts/:id returns 404 for non-existing post", async () => {
    const blogResponse = await request(app)
      .post(`${API_PREFIX}/blogs`)
      .set("authorization", ADMIN_AUTH)
      .send({ name: "Blog", description: "desc", websiteUrl: "https://blog.com" })
      .expect(201);

    await request(app)
      .put(`${API_PREFIX}/posts/123456`)
      .set("authorization", ADMIN_AUTH)
      .send({ title: "T", shortDescription: "S", content: "C", blogId: blogResponse.body.id })
      .expect(404);
  });

  it("POST /blogs/:id/posts returns 401 without auth", async () => {
    const blogResponse = await request(app)
      .post(`${API_PREFIX}/blogs`)
      .set("authorization", ADMIN_AUTH)
      .send({ name: "Blog A", description: "desc", websiteUrl: "https://bloga.com" })
      .expect(201);

    await request(app)
      .post(`${API_PREFIX}/blogs/${blogResponse.body.id}/posts`)
      .send({ title: "T", shortDescription: "S", content: "C" })
      .expect(401);
  });

  it("POST /blogs/:id/posts returns 404 for non-existing blog", async () => {
    await request(app)
      .post(`${API_PREFIX}/blogs/999/posts`)
      .set("authorization", ADMIN_AUTH)
      .send({ title: "T", shortDescription: "S", content: "C" })
      .expect(404);
  });
});
