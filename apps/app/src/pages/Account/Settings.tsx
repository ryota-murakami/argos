import { ChevronDownIcon, ChevronRightIcon } from "@primer/octicons-react";
import {
  Disclosure,
  DisclosureContent,
  useDisclosureState,
} from "ariakit/disclosure";
import moment from "moment";
import { Helmet } from "react-helmet";
import { useParams } from "react-router-dom";

import config from "@/config";
import { AccountChangeName } from "@/containers/Account/ChangeName";
import { AccountChangeSlug } from "@/containers/Account/ChangeSlug";
import { Query } from "@/containers/Apollo";
import { SettingsLayout } from "@/containers/Layout";
import { TeamMembers } from "@/containers/Team/Members";
import { DocumentType, graphql } from "@/gql";
import { Permission } from "@/gql/graphql";
import { NotFound } from "@/pages/NotFound";
import {
  Card,
  CardBody,
  CardFooter,
  CardParagraph,
  CardSeparator,
  CardTitle,
} from "@/ui/Card";
import { Container } from "@/ui/Container";
import { Anchor, Link } from "@/ui/Link";
import { PageLoader } from "@/ui/PageLoader";
import { Progress } from "@/ui/Progress";
import { StripePortalLink } from "@/ui/StripePortalLink";
import { Time } from "@/ui/Time";
import { Heading } from "@/ui/Typography";

import { useAccountContext } from ".";

const AccountQuery = graphql(`
  query AccountSettings_account($slug: String!) {
    account(slug: $slug) {
      id
      name
      screenshotsLimitPerMonth
      stripeCustomerId
      permissions

      plan {
        id
        name
        screenshotsLimitPerMonth
      }

      purchase {
        id
        source
      }

      projects(first: 100, after: 0) {
        edges {
          id
          name
          public
          currentMonthUsedScreenshots
        }
      }
      ...TeamMembers_Team
      ...AccountChangeName_Account
      ...AccountChangeSlug_Account
    }
  }
`);

type AccountDocument = DocumentType<typeof AccountQuery>;
type Plan = NonNullable<NonNullable<AccountDocument["account"]>["plan"]>;
type Purchase = NonNullable<
  NonNullable<AccountDocument["account"]>["purchase"]
>;
type Project = NonNullable<AccountDocument["account"]>["projects"]["edges"][0];

const sumUsedScreenshots = (projects: Project[]) =>
  projects.reduce(
    (sum, project) => project.currentMonthUsedScreenshots + sum,
    0
  );

const ManageSubscriptionLink = ({
  purchase,
  stripeCustomerId,
}: {
  purchase: Purchase;
  stripeCustomerId: string | null;
}) => {
  if (purchase.source === "stripe") {
    return <StripePortalLink stripeCustomerId={stripeCustomerId} />;
  }

  return (
    <Anchor href={config.get("github.marketplaceUrl")} external>
      Manage your subscription on GitHub
    </Anchor>
  );
};

const PlanCard = ({
  accountSlug,
  plan,
  purchase,
  stripeCustomerId,
  projects,
}: {
  accountSlug: string;
  plan: Plan;
  purchase: Purchase | null;
  stripeCustomerId: string | null;
  projects: Project[];
}) => {
  const free = plan.name === "free";
  const [privateProjects, publicProjects] = projects.reduce(
    (all, project) => {
      const groupId = project.public ? 1 : 0;
      if (project.currentMonthUsedScreenshots > 0) {
        all[groupId].push(project);
      }
      return all;
    },
    [[] as Project[], [] as Project[]]
  );
  const hasStripePurchase = purchase && purchase.source === "stripe";
  return (
    <Card>
      <CardBody>
        <CardTitle>Plan</CardTitle>
        <CardParagraph>
          Your account is on the{" "}
          <strong className="capitalize">{plan.name} plan</strong>.
          {free && " Free of charge."}{" "}
          {!hasStripePurchase && (
            <Anchor href={config.get("github.marketplaceUrl")} external>
              Learn more
            </Anchor>
          )}
        </CardParagraph>
        <CardSeparator className="my-6" />
        <div className="my-6">
          <div className="font-medium">
            Current period (
            {
              <Time
                date={moment().startOf("month").toISOString()}
                format="MMM DD"
              />
            }{" "}
            -{" "}
            {
              <Time
                date={moment().endOf("month").toISOString()}
                format="MMM DD"
              />
            }
            )
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2 rounded border border-border p-4">
              <div className="font-medium">Private projects</div>
              <Consumption
                value={sumUsedScreenshots(privateProjects)}
                max={
                  plan.screenshotsLimitPerMonth === -1
                    ? Infinity
                    : plan.screenshotsLimitPerMonth
                }
              />
              {privateProjects.length > 0 && (
                <div>
                  <ConsumptionDetail projects={privateProjects} />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 rounded border border-border p-4">
              <div className="font-medium">Public projects</div>
              <Consumption
                value={sumUsedScreenshots(publicProjects)}
                max={Infinity}
              />
              {publicProjects.length > 0 && (
                <div>
                  <ConsumptionDetail projects={publicProjects} />
                </div>
              )}
            </div>
          </div>
        </div>
      </CardBody>
      <CardFooter>
        {purchase ? (
          <ManageSubscriptionLink
            purchase={purchase}
            stripeCustomerId={stripeCustomerId}
          />
        ) : (
          <>
            Subscribe to plan using{" "}
            <Link to={`/${accountSlug}/checkout`}>Stripe</Link> or{" "}
            <Anchor href={config.get("github.marketplaceUrl")} external>
              GitHub Marketplace
            </Anchor>{" "}
            .
          </>
        )}
      </CardFooter>
    </Card>
  );
};

const Consumption = ({ value, max }: { value: number; max: number }) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between font-medium">
        <div>
          {value.toLocaleString()} {value > 1 ? "screenshots" : "screenshot"}
        </div>
        <div className="text-on-light">
          / {max === Infinity ? "Unlimited" : max.toLocaleString()}
        </div>
      </div>
      <Progress value={value} max={max} min={0} />
    </div>
  );
};

const ConsumptionDetail = ({ projects }: { projects: Project[] }) => {
  const disclosure = useDisclosureState({ defaultOpen: false });

  return (
    <>
      <Disclosure
        state={disclosure}
        className="text-sm text-on-light transition hover:text-on focus:outline-none"
      >
        {disclosure.open ? "Hide" : "Show"} usage detail{" "}
        {disclosure.open ? <ChevronDownIcon /> : <ChevronRightIcon />}
      </Disclosure>

      <DisclosureContent
        state={disclosure}
        as="ul"
        className="mt-2 text-sm text-on-light"
      >
        {projects.map((project) => (
          <li
            key={project.id}
            className="flex items-center justify-between border-b border-b-border px-1 py-1 last:border-b-0"
          >
            <span>{project.name}</span>
            <span className="tabular-nums">
              {project.currentMonthUsedScreenshots.toLocaleString()}
            </span>
          </li>
        ))}
      </DisclosureContent>
    </>
  );
};

export const AccountSettings = () => {
  const { accountSlug } = useParams();
  const { hasWritePermission } = useAccountContext();

  if (!accountSlug) {
    return <NotFound />;
  }

  if (!hasWritePermission) {
    return <NotFound />;
  }

  return (
    <Container>
      <Helmet>
        <title>{accountSlug} • Settings</title>
      </Helmet>
      <Heading>Account Settings</Heading>
      <Query
        fallback={<PageLoader />}
        query={AccountQuery}
        variables={{ slug: accountSlug }}
      >
        {({ account }) => {
          if (!account) return <NotFound />;
          const isTeam = account.__typename === "Team";
          const writable = account.permissions.includes(Permission.Write);

          return (
            <SettingsLayout>
              {writable &&
                (() => {
                  switch (account.__typename) {
                    case "User":
                      return (
                        <>
                          <AccountChangeName
                            account={account}
                            title="Your Name"
                            description="Please enter your full name, or a display name you are comfortable with."
                          />
                          <AccountChangeSlug
                            account={account}
                            title="Your Username"
                            description="This is your URL namespace within Argos."
                          />
                        </>
                      );
                    case "Team":
                      return (
                        <>
                          <AccountChangeName
                            account={account}
                            title="Team Name"
                            description="This is your team's visible name within Argos. For example, the
              name of your company or department."
                          />
                          <AccountChangeSlug
                            account={account}
                            title="Team URL"
                            description="This is your team’s URL namespace on Argos. Within it, your team
                    can inspect their projects or configure settings."
                          />
                        </>
                      );
                  }
                  return null;
                })()}
              {writable && account.plan && (
                <PlanCard
                  accountSlug={accountSlug}
                  plan={account.plan}
                  purchase={account.purchase ?? null}
                  stripeCustomerId={account.stripeCustomerId ?? null}
                  projects={account.projects.edges}
                />
              )}
              {isTeam && <TeamMembers team={account} />}
            </SettingsLayout>
          );
        }}
      </Query>
    </Container>
  );
};
