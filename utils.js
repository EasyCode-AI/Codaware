// Utility Functions

/**
 * Tokenizes code into alphanumeric tokens.
 * @param {string} code - The code to tokenize.
 * @returns {string[]} - An array of lowercase tokens.
 */
function tokenizeCode(code) {
  const tokens = code.match(/\w+/g);
  if (!tokens) return [];
  return tokens.map(token => token.toLowerCase()); // Convert to lowercase
}

/**
 * Normalizes a vector to mimic Python's sklearn normalization.
 * @param {number[]} vector - The vector to normalize.
 * @returns {number[]} - The normalized vector.
 */
function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val ** 2, 0));
  if (magnitude === 0) return vector.map(() => 0); // Return a zero vector
  return vector.map(val => val / magnitude);
}

/**
 * Computes cosine similarity between two vectors.
 * @param {number[]} vec1 - The first vector.
 * @param {number[]} vec2 - The second vector.
 * @returns {number} - The cosine similarity score.
 */
function cosineSimilarity(vec1, vec2) {
  const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val ** 2, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val ** 2, 0));

  if (magnitude1 === 0 || magnitude2 === 0) return 0; // No similarity

  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  return dotProduct / (magnitude1 * magnitude2);
}

// Custom TF-IDF Class

class CustomTfIdf {
  constructor() {
    this.documents = [];
    this.vocabulary = new Set();
    this.termFrequencies = new Map();
    this.inverseDocumentFrequencies = new Map();
  }

  /**
   * Adds a document to the corpus.
   * @param {string} doc - The document text.
   */
  addDocument(doc) {
    const tokens = tokenizeCode(doc);
    this.documents.push(tokens);
    const docIndex = this.documents.length - 1;

    const tfMap = new Map();
    tokens.forEach(token => {
      this.vocabulary.add(token);
      tfMap.set(token, (tfMap.get(token) || 0) + 1);
    });

    // Normalize TF
    const totalTerms = tokens.length;
    tfMap.forEach((count, term) => {
      tfMap.set(term, count / totalTerms);
    });

    this.termFrequencies.set(docIndex, tfMap);
  }

  /**
   * Computes IDF for each term in the vocabulary.
   */
  computeIdf() {
    const numDocuments = this.documents.length;
    this.vocabulary.forEach(term => {
      let docCount = 0;
      this.documents.forEach(doc => {
        if (doc.includes(term)) docCount += 1;
      });
      const idf = Math.log((numDocuments + 1) / (docCount + 1)) + 1; // Smoothing
      this.inverseDocumentFrequencies.set(term, idf);
    });
  }

  /**
   * Gets the TF-IDF vector for a document.
   * @param {number} docIndex - Index of the document.
   * @returns {number[]} - TF-IDF vector.
   */
  getTfIdfVector(docIndex) {
    const tfMap = this.termFrequencies.get(docIndex);
    if (!tfMap) return [];

    return Array.from(this.vocabulary).map(term => {
      const tf = tfMap.get(term) || 0;
      const idf = this.inverseDocumentFrequencies.get(term) || 0;
      return tf * idf;
    });
  }

  /**
   * Finalizes the TF-IDF computation by calculating IDF.
   */
  finalize() {
    this.computeIdf();
  }

  /**
   * Returns the size of the vocabulary.
   * @returns {number} - Vocabulary size.
   */
  getVocabularySize() {
    return this.vocabulary.size;
  }
}

// Main Function to Find Best Match

/**
 * Finds the best match for a code block among a set of files based on cosine similarity.
 * @param {string} codeBlockContent - The content of the code block.
 * @param {Object} files - An object containing file names as keys and file contents as values.
 * @returns {string} - The file name with the highest similarity score.
 */
function findBestMatch(codeBlockContent, files) {
  // Input Validation
  if (!codeBlockContent || !files || Object.keys(files).length === 0) {
    console.log("Invalid input parameters");
    return '';
  }

  // Logging Inputs
  //console.log("Input code block:", codeBlockContent);
  //console.log("Input files:", files);

  const tfidf = new CustomTfIdf();
  const fileNames = Object.keys(files);
  const documentKeys = [];

  // Limit processing to the first 100 files to prevent performance issues
  fileNames.slice(0, 100).forEach(fileName => {
    const fileContent = files[fileName];
    const fileTokens = tokenizeCode(fileContent).join(' ');
    tfidf.addDocument(fileTokens);
    documentKeys.push(fileName);
  });

  // Add the code block as the last document
  tfidf.addDocument(codeBlockContent);
  documentKeys.push('codeBlock');

  // Finalize TF-IDF (compute IDF)
  tfidf.finalize();

  // Map document keys to indices
  const documentIndexMap = {};
  documentKeys.forEach((key, index) => {
    documentIndexMap[key] = index;
  });

  const codeBlockIndex = documentIndexMap['codeBlock'];

  // Get TF-IDF vector for the code block
  const codeBlockVector = tfidf.getTfIdfVector(codeBlockIndex);
  const normalizedCodeBlockVector = normalizeVector(codeBlockVector);

  // Compute cosine similarity for each file
  const similarityScores = fileNames.map(fileName => {
    const index = documentIndexMap[fileName];
    const fileVector = tfidf.getTfIdfVector(index);
    const normalizedFileVector = normalizeVector(fileVector);
    const score = cosineSimilarity(normalizedCodeBlockVector, normalizedFileVector);
    return {
      fileName,
      score,
    };
  });

  // Log Similarity Scores
  // console.log('Similarity Scores:');
  // similarityScores.forEach(({ fileName, score }) => {
  //   console.log(`${fileName}: ${score}`);
  // });

  // Find the best match
  // const bestMatch = similarityScores.reduce((best, current) =>
  //   current.score > best.score ? current : best
  // );

  return similarityScores;
}

const codeBlockContent = `
import React from 'react';
import PropTypes from 'prop-types';
import { useRouteMatch } from 'react-router-dom';
import { Draggable } from 'react-beautiful-dnd';

import { IssueTypeIcon, IssuePriorityIcon } from 'shared/components';

import { IssueLink, Issue, Title, Bottom, Assignees, AssigneeAvatar, Checkbox } from './Styles';

const propTypes = {
  projectUsers: PropTypes.array.isRequired,
  issue: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
};

const ProjectBoardListIssue = ({ projectUsers, issue, index }) => {
  const match = useRouteMatch();

  const assignees = issue.userIds.map(userId => projectUsers.find(user => user.id === userId));

  // Handler for checkbox change
  const handleCheckboxChange = (e) => {
    console.log(\`Issue \${issue.id} checkbox changed: \`, e.target.checked);
    // Implement any additional logic for handling checkbox change here
  };

  return (
    <Draggable draggableId={issue.id.toString()} index={index}>
      {(provided, snapshot) => (
        <Issue
          to={\`\${match.url}/issues/\${issue.id}\`}
          ref={provided.innerRef}
          data-testid="list-issue"
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          {/* Checkbox */}
          <Checkbox>
            <input
              type="checkbox"
              onChange={handleCheckboxChange}
              aria-label={\`Mark issue \${issue.id} as completed\`}
            />
          </Checkbox>

          {/* Issue content */}
          <div>
            <Title>{issue.title}</Title>
            <Bottom>
              <div>
                {assignees.map(user => (
                  <AssigneeAvatar
                    key={user.id}
                    size={24}
                    avatarUrl={user.avatarUrl}
                    name={user.name}
                  />
                ))}
              </div>
            </Bottom>
          </div>
        </Issue>
      )}
    </Draggable>
  );
};

ProjectBoardListIssue.propTypes = propTypes;

export default ProjectBoardListIssue;
`;

const files = {
  "Issue.jsx": `import React from 'react';
import PropTypes from 'prop-types';
import { useRouteMatch } from 'react-router-dom';
import { Draggable } from 'react-beautiful-dnd';

import { IssueTypeIcon, IssuePriorityIcon } from 'shared/components';

import { IssueLink, Issue, Title, Bottom, Assignees, AssigneeAvatar } from './Styles';

const propTypes = {
  projectUsers: PropTypes.array.isRequired,
  issue: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
};

const ProjectBoardListIssue = ({ projectUsers, issue, index }) => {
  const match = useRouteMatch();

  const assignees = issue.userIds.map(userId => projectUsers.find(user => user.id === userId));

  return (
    <Draggable draggableId={issue.id.toString()} index={index}>
      {(provided, snapshot) => (
        <IssueLink
          to={\`\${match.url}/issues/\${issue.id}\`}
          ref={provided.innerRef}
          data-testid="list-issue"
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Issue isBeingDragged={snapshot.isDragging && !snapshot.isDropAnimating}>
            <Title>{issue.title}</Title>
            <Bottom>
              <div>
                <IssueTypeIcon type={issue.type} />
                <IssuePriorityIcon priority={issue.priority} top={-1} left={4} />
              </div>
              <Assignees>
                {assignees.map(user => (
                  <AssigneeAvatar
                    key={user.id}
                    size={24}
                    avatarUrl={user.avatarUrl}
                    name={user.name}
                  />
                ))}
              </Assignees>
            </Bottom>
          </Issue>
        </IssueLink>
      )}
    </Draggable>
  );
};

ProjectBoardListIssue.propTypes = propTypes;

export default ProjectBoardListIssue;
`, // Add file content here
  "Board.jsx": `
  import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Route, useRouteMatch, useHistory } from 'react-router-dom';

import useMergeState from 'shared/hooks/mergeState';
import { Breadcrumbs, Modal } from 'shared/components';

import Header from './Header';
import Filters from './Filters';
import Lists from './Lists/Lists';
import IssueDetails from './IssueDetails';

const propTypes = {
  project: PropTypes.object.isRequired,
  fetchProject: PropTypes.func.isRequired,
  updateLocalProjectIssues: PropTypes.func.isRequired,
};

const defaultFilters = {
  searchTerm: '',
  userIds: [],
  myOnly: false,
  recent: false,
};

const ProjectBoard = ({ project, fetchProject, updateLocalProjectIssues }) => {
  const match = useRouteMatch();
  const history = useHistory();

  const [filters, mergeFilters] = useMergeState(defaultFilters);

  return (
    <Fragment>
      <Breadcrumbs items={['Projects', project.name, 'Kanban Board']} />
      <Header />
      <Filters
        projectUsers={project.users}
        defaultFilters={defaultFilters}
        filters={filters}
        mergeFilters={mergeFilters}
      />
      <Lists
        project={project}
        filters={filters}
        updateLocalProjectIssues={updateLocalProjectIssues}
      />
      <Route
        path={\`\${match.path}/issues/:issueId\`}
        render={routeProps => (
          <Modal
            isOpen
            testid="modal:issue-details"
            width={1040}
            withCloseIcon={false}
            onClose={() => history.push(match.url)}
            renderContent={modal => (
              <IssueDetails
                issueId={routeProps.match.params.issueId}
                projectUsers={project.users}
                fetchProject={fetchProject}
                updateLocalProjectIssues={updateLocalProjectIssues}
                modalClose={modal.close}
              />
            )}
          />
        )}
      />
    </Fragment>
  );
};

ProjectBoard.propTypes = propTypes;

export default ProjectBoard;
`, // Add file content here
  "Lists.jsx": `import React from 'react';
import PropTypes from 'prop-types';
import { DragDropContext } from 'react-beautiful-dnd';

import useCurrentUser from 'shared/hooks/currentUser';
import api from 'shared/utils/api';
import { moveItemWithinArray, insertItemIntoArray } from 'shared/utils/javascript';
import { IssueStatus } from 'shared/constants/issues';

import List from './List/List';
import { Lists } from './Styles';

const propTypes = {
  project: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  updateLocalProjectIssues: PropTypes.func.isRequired,
};

const ProjectBoardLists = ({ project, filters, updateLocalProjectIssues }) => {
  const { currentUserId } = useCurrentUser();

  const handleIssueDrop = ({ draggableId, destination, source }) => {
    if (!isPositionChanged(source, destination)) return;

    const issueId = Number(draggableId);

    api.optimisticUpdate(\`/issues/\${issueId}\`, {
      updatedFields: {
        status: destination.droppableId,
        listPosition: calculateIssueListPosition(project.issues, destination, source, issueId),
      },
      currentFields: project.issues.find(({ id }) => id === issueId),
      setLocalData: fields => updateLocalProjectIssues(issueId, fields),
    });
  };

  return (
    <DragDropContext onDragEnd={handleIssueDrop}>
      <Lists>
        {Object.values(IssueStatus).map(status => (
          <List
            key={status}
            status={status}
            project={project}
            filters={filters}
            currentUserId={currentUserId}
          />
        ))}
      </Lists>
    </DragDropContext>
  );
};

const isPositionChanged = (destination, source) => {
  if (!destination) return false;
  const isSameList = destination.droppableId === source.droppableId;
  const isSamePosition = destination.index === source.index;
  return !isSameList || !isSamePosition;
};

const calculateIssueListPosition = (...args) => {
  const { prevIssue, nextIssue } = getAfterDropPrevNextIssue(...args);
  let position;

  if (!prevIssue && !nextIssue) {
    position = 1;
  } else if (!prevIssue) {
    position = nextIssue.listPosition - 1;
  } else if (!nextIssue) {
    position = prevIssue.listPosition + 1;
  } else {
    position = prevIssue.listPosition + (nextIssue.listPosition - prevIssue.listPosition) / 2;
  }
  return position;
};

const getAfterDropPrevNextIssue = (allIssues, destination, source, droppedIssueId) => {
  const beforeDropDestinationIssues = getSortedListIssues(allIssues, destination.droppableId);
  const droppedIssue = allIssues.find(issue => issue.id === droppedIssueId);
  const isSameList = destination.droppableId === source.droppableId;

  const afterDropDestinationIssues = isSameList
    ? moveItemWithinArray(beforeDropDestinationIssues, droppedIssue, destination.index)
    : insertItemIntoArray(beforeDropDestinationIssues, droppedIssue, destination.index);

  return {
    prevIssue: afterDropDestinationIssues[destination.index - 1],
    nextIssue: afterDropDestinationIssues[destination.index + 1],
  };
};

const getSortedListIssues = (issues, status) =>
  issues.filter(issue => issue.status === status).sort((a, b) => a.listPosition - b.listPosition);

ProjectBoardLists.propTypes = propTypes;

export default ProjectBoardLists;
`, // Add file content here
};

// Example Usage
//const bestMatch = findBestMatch(codeBlockContent, files);
//console.log(`The code block most likely belongs to: ${bestMatch}`);