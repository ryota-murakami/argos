import { graphql } from "@/gql";
import { Button } from "@/ui/Button";
import { List, ListRow } from "@/ui/List";
import { Loader } from "@/ui/Loader";
import { Time } from "@/ui/Time";

import { Query } from "./Apollo";

const ProjectsQuery = graphql(`
  query GitlabProjectList_glApiProjects(
    $accountId: ID!
    $userId: ID
    $groupId: ID
    $allProjects: Boolean!
    $page: Int!
    $search: String
  ) {
    glApiProjects(
      userId: $userId
      groupId: $groupId
      allProjects: $allProjects
      accountId: $accountId
      page: $page
      search: $search
    ) {
      edges {
        id
        name
        last_activity_at
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`);

export type GitlabProjectListProps = {
  accountId: string;
  onSelectProject: (project: { id: string }) => void;
  disabled?: boolean;
  connectButtonLabel: string;
  search: string;
  allProjects: boolean;
} & (
  | { groupId: string; userId?: never }
  | { groupId?: never; userId: string }
  | { groupId?: never; userId?: never }
);

export const GitlabProjectList = (props: GitlabProjectListProps) => {
  return (
    <Query
      fallback={<Loader />}
      query={ProjectsQuery}
      variables={{
        accountId: props.accountId,
        userId: props.userId,
        groupId: props.groupId,
        allProjects: props.allProjects,
        search: props.search,
        page: 1,
      }}
    >
      {({ glApiProjects }) => {
        if (glApiProjects.edges.length === 0) {
          return (
            <div className="text-center">No projects in this namespace</div>
          );
        }
        return (
          <List>
            {glApiProjects.edges.map((project) => (
              <ListRow
                key={project.id}
                className="items-center justify-between p-4"
              >
                <div>
                  {project.name} •{" "}
                  <Time date={project.last_activity_at} className="text-low" />
                </div>
                <Button
                  onClick={() => {
                    props.onSelectProject(project);
                  }}
                  disabled={props.disabled}
                >
                  {props.connectButtonLabel}
                </Button>
              </ListRow>
            ))}
          </List>
        );
      }}
    </Query>
  );
};
