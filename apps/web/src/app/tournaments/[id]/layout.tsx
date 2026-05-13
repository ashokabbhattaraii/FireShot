export async function generateStaticParams() {
  return [{ id: "_" }];
}
export const dynamicParams = true;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
