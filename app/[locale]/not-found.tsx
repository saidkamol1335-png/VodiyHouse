import { Container } from "@/components/Container";
import { Heading } from "@/components/Heading";
import { SiteHeader } from "@/components/SiteHeader";

export default function LocaleNotFound() {
  return (
    <>
      <SiteHeader />
      <Container as="main">
        <div className="py-24">
          <Heading level={2}>404</Heading>
        </div>
      </Container>
    </>
  );
}
