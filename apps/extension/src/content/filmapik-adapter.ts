import { extractMediaId } from "../shared/site";
import { GenericHTML5VideoAdapter } from "./generic-adapter";

export class FilmapikAdapter extends GenericHTML5VideoAdapter {
  override getMediaId(): string | null {
    return extractMediaId(window.location.href) ?? super.getMediaId();
  }

  static supportsLocation(url: string): boolean {
    try {
      return new URL(url).origin === "https://filmapik.college";
    } catch {
      return false;
    }
  }
}
