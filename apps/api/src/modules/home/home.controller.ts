import { Controller, Get, Header } from "@nestjs/common";
import { HomeService } from "./home.service";

@Controller("home")
export class HomeController {
  constructor(private svc: HomeService) {}

  @Get()
  @Header("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60")
  getHome() {
    return this.svc.getHomeData();
  }
}
