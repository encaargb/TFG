export const ProjectDocumentModel = {
  id: "doc1",
  pages: Array.from({ length: 15 }, (_, i) =>
    `/documents/doc1/pages/pg${i + 1}.jpeg`
  ),
  regions: []
}
