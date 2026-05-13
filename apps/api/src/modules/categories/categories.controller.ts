import { Controller, Get } from "@nestjs/common";
import { CategoriesService } from "./categories.service";

@Controller("categories")
export class CategoriesController {
  constructor(private svc: CategoriesService) {}

  @Get()
  list() {
    return this.svc.getActiveCategories();
  }
}
