variable "project" {
  type        = string
  description = "GCP project id."
}

variable "image" {
  type        = string
  description = "Container image for the rag-api Cloud Run service."
}
