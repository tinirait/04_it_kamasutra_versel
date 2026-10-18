const express = require("express");

const app = express();
app.use(express.json());

const db = { blogs: [], posts: [] };
let blogIdCounter = 1;
let postIdCounter = 1;

const createErrorsMessages = (errors) => ({ errorsMessages: errors });
const SORT_DIRECTIONS = new Set(["asc", "desc"]);

const toPositiveInt = (value, defaultValue) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
};

const getPaginationParams = (query) => {
  const pageNumber = toPositiveInt(query.pageNumber, 1);
  const pageSize = toPositiveInt(query.pageSize, 10);
  const sortBy = typeof query.sortBy === "string" && query.sortBy.trim() ? query.sortBy.trim() : "createdAt";
  const rawDirection = typeof query.sortDirection === "string" ? query.sortDirection.toLowerCase() : "desc";
  const sortDirection = SORT_DIRECTIONS.has(rawDirection) ? rawDirection : "desc";
  return { pageNumber, pageSize, sortBy, sortDirection };
};

const sortItems = (items, sortBy, sortDirection) => {
  const sorted = [...items].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    if (aValue === bValue) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;
    if (aValue > bValue) return 1;
    if (aValue < bValue) return -1;
    return 0;
  });
  return sortDirection === "asc" ? sorted : sorted.reverse();
};

const toPaginator = (allItems, pageNumber, pageSize) => {
  const totalCount = allItems.length;
  const pagesCount = Math.ceil(totalCount / pageSize);
  const start = (pageNumber - 1) * pageSize;
  const items = allItems.slice(start, start + pageSize);
  return {
    pagesCount,
    page: pageNumber,
    pageSize,
    totalCount,
    items,
  };
};

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const getBasicAuthCredentials = (authHeader) => {
  if (typeof authHeader !== "string" || !authHeader.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const i = decoded.indexOf(":");
    if (i === -1) return null;
    return { login: decoded.slice(0, i), password: decoded.slice(i + 1) };
  } catch {
    return null;
  }
};

const requireAdminAuth = (req, res, next) => {
  const credentials = getBasicAuthCredentials(req.headers.authorization);
  if (!credentials || credentials.login !== "admin" || credentials.password !== "qwerty") {
    res.sendStatus(401);
    return;
  }
  next();
};

const validateBlogBody = (req, res, next) => {
  const errors = [];
  if (typeof req.body.name !== "string" || req.body.name.trim().length < 1 || req.body.name.trim().length > 15) {
    errors.push({ message: "Invalid name", field: "name" });
  }
  if (
    typeof req.body.description !== "string" ||
    req.body.description.trim().length < 1 ||
    req.body.description.trim().length > 500
  ) {
    errors.push({ message: "Invalid description", field: "description" });
  }
  if (
    typeof req.body.websiteUrl !== "string" ||
    req.body.websiteUrl.trim().length < 1 ||
    req.body.websiteUrl.trim().length > 100 ||
    !isHttpsUrl(req.body.websiteUrl.trim())
  ) {
    errors.push({ message: "Invalid websiteUrl", field: "websiteUrl" });
  }
  if (errors.length) {
    res.status(400).send(createErrorsMessages(errors));
    return;
  }
  next();
};

const validatePostBody = (req, res, next) => {
  const errors = [];
  if (typeof req.body.title !== "string" || req.body.title.trim().length < 1 || req.body.title.trim().length > 30) {
    errors.push({ message: "Invalid title", field: "title" });
  }
  if (
    typeof req.body.shortDescription !== "string" ||
    req.body.shortDescription.trim().length < 1 ||
    req.body.shortDescription.trim().length > 100
  ) {
    errors.push({ message: "Invalid shortDescription", field: "shortDescription" });
  }
  if (typeof req.body.content !== "string" || req.body.content.trim().length < 1 || req.body.content.trim().length > 1000) {
    errors.push({ message: "Invalid content", field: "content" });
  }
  if (typeof req.body.blogId !== "string" || !db.blogs.some((blog) => blog.id === req.body.blogId)) {
    errors.push({ message: "Invalid blogId", field: "blogId" });
  }
  if (errors.length) {
    res.status(400).send(createErrorsMessages(errors));
    return;
  }
  next();
};

const validatePostBodyWithoutBlogId = (req, res, next) => {
  const errors = [];
  if (typeof req.body.title !== "string" || req.body.title.trim().length < 1 || req.body.title.trim().length > 30) {
    errors.push({ message: "Invalid title", field: "title" });
  }
  if (
    typeof req.body.shortDescription !== "string" ||
    req.body.shortDescription.trim().length < 1 ||
    req.body.shortDescription.trim().length > 100
  ) {
    errors.push({ message: "Invalid shortDescription", field: "shortDescription" });
  }
  if (typeof req.body.content !== "string" || req.body.content.trim().length < 1 || req.body.content.trim().length > 1000) {
    errors.push({ message: "Invalid content", field: "content" });
  }
  if (errors.length) {
    res.status(400).send(createErrorsMessages(errors));
    return;
  }
  next();
};

const router = express.Router();

router.get("/blogs", (req, res) => {
  const { pageNumber, pageSize, sortBy, sortDirection } = getPaginationParams(req.query);
  const searchNameTerm = typeof req.query.searchNameTerm === "string" ? req.query.searchNameTerm.trim().toLowerCase() : null;

  const filtered = searchNameTerm
    ? db.blogs.filter((blog) => blog.name.toLowerCase().includes(searchNameTerm))
    : db.blogs;

  const sorted = sortItems(filtered, sortBy, sortDirection);
  res.status(200).send(toPaginator(sorted, pageNumber, pageSize));
});

router.post("/blogs", requireAdminAuth, validateBlogBody, (req, res) => {
  const blog = {
    id: String(blogIdCounter++),
    name: req.body.name.trim(),
    description: req.body.description.trim(),
    websiteUrl: req.body.websiteUrl.trim(),
    createdAt: new Date().toISOString(),
    isMembership: false,
  };
  db.blogs.push(blog);
  res.status(201).send(blog);
});

router.get("/blogs/:id", (req, res) => {
  const foundBlog = db.blogs.find((blog) => blog.id === req.params.id);
  if (!foundBlog) return res.sendStatus(404);
  res.status(200).send(foundBlog);
});

router.get("/blogs/:blogId/posts", (req, res) => {
  const blog = db.blogs.find((item) => item.id === req.params.blogId);
  if (!blog) return res.sendStatus(404);

  const { pageNumber, pageSize, sortBy, sortDirection } = getPaginationParams(req.query);
  const blogPosts = db.posts.filter((post) => post.blogId === req.params.blogId);
  const sorted = sortItems(blogPosts, sortBy, sortDirection);
  res.status(200).send(toPaginator(sorted, pageNumber, pageSize));
});

router.post("/blogs/:blogId/posts", requireAdminAuth, validatePostBodyWithoutBlogId, (req, res) => {
  const blog = db.blogs.find((item) => item.id === req.params.blogId);
  if (!blog) return res.sendStatus(404);

  const post = {
    id: String(postIdCounter++),
    title: req.body.title.trim(),
    shortDescription: req.body.shortDescription.trim(),
    content: req.body.content.trim(),
    blogId: blog.id,
    blogName: blog.name,
    createdAt: new Date().toISOString(),
  };
  db.posts.push(post);
  res.status(201).send(post);
});

router.put("/blogs/:id", requireAdminAuth, validateBlogBody, (req, res) => {
  const foundBlog = db.blogs.find((blog) => blog.id === req.params.id);
  if (!foundBlog) return res.sendStatus(404);
  foundBlog.name = req.body.name.trim();
  foundBlog.description = req.body.description.trim();
  foundBlog.websiteUrl = req.body.websiteUrl.trim();
  res.sendStatus(204);
});

router.delete("/blogs/:id", requireAdminAuth, (req, res) => {
  const blogIndex = db.blogs.findIndex((blog) => blog.id === req.params.id);
  if (blogIndex === -1) return res.sendStatus(404);
  db.blogs.splice(blogIndex, 1);
  db.posts = db.posts.filter((post) => post.blogId !== req.params.id);
  res.sendStatus(204);
});

router.get("/posts", (req, res) => {
  const { pageNumber, pageSize, sortBy, sortDirection } = getPaginationParams(req.query);
  const sorted = sortItems(db.posts, sortBy, sortDirection);
  res.status(200).send(toPaginator(sorted, pageNumber, pageSize));
});

router.post("/posts", requireAdminAuth, validatePostBody, (req, res) => {
  const blog = db.blogs.find((item) => item.id === req.body.blogId);
  const post = {
    id: String(postIdCounter++),
    title: req.body.title.trim(),
    shortDescription: req.body.shortDescription.trim(),
    content: req.body.content.trim(),
    blogId: req.body.blogId,
    blogName: blog.name,
    createdAt: new Date().toISOString(),
  };
  db.posts.push(post);
  res.status(201).send(post);
});

router.get("/posts/:id", (req, res) => {
  const foundPost = db.posts.find((post) => post.id === req.params.id);
  if (!foundPost) return res.sendStatus(404);
  res.status(200).send(foundPost);
});

router.put("/posts/:id", requireAdminAuth, validatePostBody, (req, res) => {
  const foundPost = db.posts.find((post) => post.id === req.params.id);
  if (!foundPost) return res.sendStatus(404);
  const blog = db.blogs.find((item) => item.id === req.body.blogId);
  foundPost.title = req.body.title.trim();
  foundPost.shortDescription = req.body.shortDescription.trim();
  foundPost.content = req.body.content.trim();
  foundPost.blogId = req.body.blogId;
  foundPost.blogName = blog.name;
  res.sendStatus(204);
});

router.delete("/posts/:id", requireAdminAuth, (req, res) => {
  const postIndex = db.posts.findIndex((post) => post.id === req.params.id);
  if (postIndex === -1) return res.sendStatus(404);
  db.posts.splice(postIndex, 1);
  res.sendStatus(204);
});

router.delete("/testing/all-data", (req, res) => {
  db.blogs = [];
  db.posts = [];
  blogIdCounter = 1;
  postIdCounter = 1;
  res.sendStatus(204);
});

app.get("/", (req, res) => res.status(200).send("Hello world!"));
app.use("/hometask_03/api", router);
app.use("/hometask_04/api", router);
app.use("/api/index.js", router);
app.use("", router);

module.exports = app;
