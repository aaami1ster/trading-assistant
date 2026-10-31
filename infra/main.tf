# infra/main.tf
provider "google" { project = var.project  region = "me-central1" }

resource "google_service_account" "api" { account_id = "rag-api-sa" }

resource "google_storage_bucket" "docs" {
  name = "${var.project}-docs"  location = "ME-CENTRAL1"  uniform_bucket_level_access = true
}

resource "google_cloud_run_v2_service" "api" {
  name     = "rag-api"
  location = "me-central1"
  template {
    service_account = google_service_account.api.email
    containers { image = var.image }
    scaling { min_instance_count = 0  max_instance_count = 3 }
  }
}
